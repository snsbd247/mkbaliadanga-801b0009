<?php

namespace App\Http\Controllers;

use App\Http\Controllers\SmsController;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Edge-function dispatcher — a Laravel replacement for Supabase Edge
 * Functions (supabase.functions.invoke(name, { body })).
 *
 * The frontend `db.functions.invoke(name, { body })` adapter posts to
 * /api/fn/{name} with the body as JSON. Each handler below mirrors the
 * behaviour of the original edge function using server-side controllers.
 *
 * Authorisation is enforced by the route middleware (auth:sanctum +
 * branch.scope).
 */
class FunctionController extends Controller
{
    public function handle(Request $request, string $name): JsonResponse
    {
        $method = 'fn_' . str_replace('-', '_', $name);

        if (! method_exists($this, $method)) {
            return response()->json([
                'error' => "Function '$name' is not available on this server.",
            ], 501);
        }

        return $this->{$method}($request);
    }

    /** Send a transactional SMS (delegates to SmsController). */
    protected function fn_send_sms(Request $request): JsonResponse
    {
        return app(SmsController::class)->send($request);
    }

    /** Trigger due-reminder SMS run. */
    protected function fn_sms_due_reminders(Request $request): JsonResponse
    {
        if (method_exists(SmsController::class, 'dueReminders')) {
            return app(SmsController::class)->dueReminders($request);
        }
        return response()->json(['error' => 'Due reminders not configured.'], 501);
    }

    /** Laravel/VPS mirror of the payment-edit edge function. */
    protected function fn_payment_edit(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $actor) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roles = method_exists($actor, 'roleNames') ? $actor->roleNames() : [];
        $isSuper = in_array('developer', $roles, true) || in_array('super_admin', $roles, true);
        $isAdmin = $isSuper || in_array('admin', $roles, true);
        $allowed = $isAdmin || (method_exists($actor, 'hasPermission') && ($actor->hasPermission('payments.manage') || $actor->hasPermission('payments.edit')));
        if (! $allowed) {
            return response()->json(['error' => 'Forbidden: no edit permission for payments'], 403);
        }

        $paymentId = (string) $request->input('payment_id', '');
        $reason = trim((string) $request->input('reason', ''));
        if ($paymentId === '') return response()->json(['error' => 'payment_id required'], 400);
        if ($reason === '') return response()->json(['error' => 'reason required'], 400);

        $newAmount = (int) round((float) $request->input('amount', 0));
        if ($newAmount < 0) return response()->json(['error' => 'amount must be >= 0'], 400);
        $newNote = $request->has('note') && trim((string) $request->input('note')) !== '' ? trim((string) $request->input('note')) : null;
        $newMouza = $request->has('mouza') && $request->input('mouza') !== null ? trim((string) $request->input('mouza')) : null;
        $newSize = $request->has('land_size') && $request->input('land_size') !== null ? (float) $request->input('land_size') : null;
        $newOwner = $request->filled('owner_farmer_id') ? (string) $request->input('owner_farmer_id') : null;
        $newFee = $request->has('delay_fee') && $request->input('delay_fee') !== null ? (int) round((float) $request->input('delay_fee')) : null;
        $newReceiptNo = $request->has('receipt_no') && $request->input('receipt_no') !== null ? trim((string) $request->input('receipt_no')) : null;
        $newPatwariProvided = $request->has('patwari_id');
        $newPatwariId = $newPatwariProvided && $request->filled('patwari_id') ? (string) $request->input('patwari_id') : null;

        $pay = DB::table('payments')->where('id', $paymentId)->first();
        if (! $pay) return response()->json(['error' => 'Payment not found'], 404);
        if (($pay->voided_at ?? null) || ($pay->status ?? null) === 'voided') {
            return response()->json(['error' => 'Cannot edit a voided receipt'], 409);
        }

        $irrAlloc = Schema::hasTable('payment_allocations')
            ? DB::table('payment_allocations')->where('payment_id', $paymentId)->where('kind', 'irrigation')->whereNotNull('reference_id')->first()
            : null;
        $invId = $irrAlloc->reference_id ?? ((($pay->kind ?? null) === 'irrigation' && ($pay->reference_id ?? null)) ? $pay->reference_id : null);
        $landId = $invId && Schema::hasTable('irrigation_invoices') ? DB::table('irrigation_invoices')->where('id', $invId)->value('land_id') : null;

        if ($newOwner && ! DB::table('farmers')->where('id', $newOwner)->exists()) {
            return response()->json(['error' => 'ভুল কৃষক: farmer not found'], 400);
        }
        if ($newPatwariId && ! DB::table('patwaris')->where('id', $newPatwariId)->exists()) {
            return response()->json(['error' => 'ভুল পাটুয়ারি: patwari not found'], 400);
        }

        if ($invId && Schema::hasTable('irrigation_invoices')) {
            $invV = DB::table('irrigation_invoices')->where('id', $invId)->first(['payable_amount', 'delay_fee']);
            if ($invV) {
                $basePayable = (float) ($invV->payable_amount ?? 0);
                $feeDelta = $newFee !== null ? ($newFee - (float) ($invV->delay_fee ?? 0)) : 0;
                $effectivePayable = $basePayable + $feeDelta;
                if ($newAmount > $effectivePayable) {
                    return response()->json(['error' => "অঙ্ক প্রদেয়র চেয়ে বেশি (max $effectivePayable)"], 400);
                }
            }
        }

        $before = [];
        $after = [];

        if ($landId && ($newMouza !== null || $newSize !== null) && Schema::hasTable('lands')) {
            $land = DB::table('lands')->where('id', $landId)->first(['mouza', 'land_size']);
            if ($land) {
                $m = $newMouza !== null ? $newMouza : $land->mouza;
                $s = $newSize !== null ? $newSize : (float) ($land->land_size ?? 0);
                if (($land->mouza ?? null) !== $m || (float) ($land->land_size ?? 0) !== $s) {
                    $before['land'] = ['mouza' => $land->mouza ?? null, 'land_size' => $land->land_size ?? null];
                    $after['land'] = ['mouza' => $m, 'land_size' => $s];
                    DB::table('lands')->where('id', $landId)->update(array_filter(['mouza' => $m, 'land_size' => $s], fn ($v, $k) => Schema::hasColumn('lands', $k), ARRAY_FILTER_USE_BOTH));
                }
            }
        }

        if ($invId && ($newOwner !== null || $newFee !== null) && Schema::hasTable('irrigation_invoices')) {
            $inv = DB::table('irrigation_invoices')->where('id', $invId)->first(['owner_farmer_id', 'delay_fee', 'payable_amount', 'due_amount', 'paid_amount']);
            if ($inv) {
                $patch = [];
                if ($newOwner !== null && ($inv->owner_farmer_id ?? null) !== $newOwner) {
                    $before['owner'] = $inv->owner_farmer_id ?? null; $after['owner'] = $newOwner; $patch['owner_farmer_id'] = $newOwner;
                }
                if ($newFee !== null) {
                    $oldFee = (float) ($inv->delay_fee ?? 0);
                    if ($oldFee !== (float) $newFee) {
                        $before['delay_fee'] = $oldFee; $after['delay_fee'] = $newFee;
                        $patch['delay_fee'] = $newFee;
                        $patch['payable_amount'] = (float) ($inv->payable_amount ?? 0) + ($newFee - $oldFee);
                        $patch['due_amount'] = max(0, (float) ($inv->due_amount ?? 0) + ($newFee - $oldFee));
                    }
                }
                if ($patch) DB::table('irrigation_invoices')->where('id', $invId)->update($patch);
            }
        }

        if ($newAmount !== (int) round((float) ($pay->amount ?? 0))) {
            $oldAmount = (float) ($pay->amount ?? 0);
            $diff = $newAmount - $oldAmount;
            $before['amount'] = $oldAmount; $after['amount'] = $newAmount;
            DB::table('payments')->where('id', $paymentId)->update(['amount' => $newAmount]);
            if ($invId && Schema::hasTable('irrigation_invoices')) {
                $inv2 = DB::table('irrigation_invoices')->where('id', $invId)->first(['paid_amount', 'payable_amount']);
                if ($inv2) {
                    $paid = max(0, round((float) ($inv2->paid_amount ?? 0) + $diff));
                    $due = max(0, round((float) ($inv2->payable_amount ?? 0)) - $paid);
                    DB::table('irrigation_invoices')->where('id', $invId)->update(['paid_amount' => $paid, 'due_amount' => $due, 'invoice_status' => $due <= 0 ? 'paid' : 'partial']);
                }
            }
            if (Schema::hasTable('payment_allocations')) DB::table('payment_allocations')->where('payment_id', $paymentId)->where('kind', 'irrigation')->update(['amount' => $newAmount]);
        }

        if (($pay->note ?? null) !== $newNote) {
            $before['note'] = $pay->note ?? null; $after['note'] = $newNote;
            DB::table('payments')->where('id', $paymentId)->update(['note' => $newNote]);
        }

        if ($newReceiptNo !== null && $newReceiptNo !== (string) ($pay->receipt_no ?? '')) {
            if ($newReceiptNo === '') return response()->json(['error' => 'receipt_no cannot be empty'], 400);
            $dup = DB::table('payments')->where('receipt_no', $newReceiptNo)->where('id', '<>', $paymentId)->exists();
            if ($dup) return response()->json(['error' => "রিসিপ্ট নম্বর ইতিমধ্যে ব্যবহৃত: $newReceiptNo"], 409);
            $before['receipt_no'] = $pay->receipt_no ?? null; $after['receipt_no'] = $newReceiptNo;
            DB::table('payments')->where('id', $paymentId)->update(['receipt_no' => $newReceiptNo]);
        }

        if ($newPatwariProvided && Schema::hasColumn('payments', 'patwari_id') && $newPatwariId !== ($pay->patwari_id ?? null)) {
            $before['patwari_id'] = $pay->patwari_id ?? null; $after['patwari_id'] = $newPatwariId;
            DB::table('payments')->where('id', $paymentId)->update(['patwari_id' => $newPatwariId]);
        }

        try {
            if (Schema::hasTable('audit_logs')) {
                $row = [
                    'id' => (string) Str::uuid(),
                    'user_id' => $actor->id,
                    'action' => 'edit',
                    'entity' => 'payments',
                    'entity_type' => 'payments',
                    'entity_id' => $paymentId,
                    'office_id' => $pay->office_id ?? null,
                    'old_values' => $before,
                    'new_values' => array_merge($after, ['reason' => $reason]),
                    'meta' => ['receipt_no' => $pay->receipt_no ?? null],
                    'created_at' => now(),
                ];
                foreach ($row as $k => $v) if (! Schema::hasColumn('audit_logs', $k)) unset($row[$k]);
                foreach (['old_values', 'new_values', 'meta'] as $jsonCol) if (isset($row[$jsonCol])) $row[$jsonCol] = json_encode($row[$jsonCol], JSON_UNESCAPED_UNICODE);
                DB::table('audit_logs')->insert($row);
            }
        } catch (\Throwable $e) {
            // Audit must not block the edit.
        }

        return response()->json(['ok' => true, 'before' => $before, 'after' => $after]);
    }

    /**
     * VPS/Laravel mirror of the receipt-serial-admin edge function.
     * Ensures the singleton receipt_settings row exists before updating, so
     * template/serial values survive a page reload after fresh VPS installs.
     */
    protected function fn_receipt_serial_admin(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $actor) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $roles = method_exists($actor, 'roleNames') ? $actor->roleNames() : [];
        if (! in_array('developer', $roles, true) && ! in_array('super_admin', $roles, true)) {
            return response()->json(['error' => 'Forbidden: only developer or super admin can change receipt serial settings'], 403);
        }

        if ($request->boolean('check')) {
            return response()->json(['ok' => true, 'available' => true, 'method' => 'laravel-function']);
        }

        if (! Schema::hasTable('receipt_settings')) {
            return response()->json(['error' => 'receipt_settings table is missing. Run backend migrations first.'], 500);
        }
        if (! Schema::hasColumn('receipt_settings', 'receipt_serial_start')) {
            return response()->json(['error' => 'receipt_serial_start column is missing. Run backend migrations first.'], 500);
        }

        $rawStart = $request->input('p_start', $request->input('start'));
        if (! is_numeric($rawStart) || floor((float) $rawStart) != (float) $rawStart) {
            return response()->json(['error' => 'শুরুর ক্রমিক নম্বর সঠিক নয়'], 400);
        }
        $start = (int) $rawStart;
        if ($start < 0) {
            return response()->json(['error' => 'ক্রমিক নম্বর ঋণাত্মক হতে পারবে না'], 400);
        }
        if ($start > 9000000000) {
            return response()->json(['error' => 'ক্রমিক নম্বর অনেক বড়'], 400);
        }

        $currentLast = 0;
        if (Schema::hasTable('receipt_counters')) {
            $currentLast = (int) (DB::table('receipt_counters')
                ->where('kind', 'SERIAL')
                ->where('year', 0)
                ->value('last_no') ?? 0);
        }
        if ($start < $currentLast) {
            return response()->json([
                'error' => "এই নম্বর ($start) বর্তমান সর্বশেষ রিসিপ্ট নম্বরের ($currentLast) চেয়ে ছোট — ডুপ্লিকেট এড়াতে বাতিল করা হলো",
            ], 409);
        }

        $exists = DB::table('receipt_settings')->where('id', 1)->exists();
        $oldStart = (int) (DB::table('receipt_settings')->where('id', 1)->value('receipt_serial_start') ?? 0);
        $row = $exists
            ? ['receipt_serial_start' => $start, 'updated_by' => $actor->id, 'updated_at' => now()]
            : array_merge($this->defaultReceiptSettingsRow($actor->id), ['receipt_serial_start' => $start]);
        $row = array_filter($row, fn ($value, $column) => Schema::hasColumn('receipt_settings', $column), ARRAY_FILTER_USE_BOTH);

        if ($exists) {
            DB::table('receipt_settings')->where('id', 1)->update($row);
        } else {
            DB::table('receipt_settings')->insert($row);
        }

        try {
            AuditLog::record([
                'user_id' => $actor->id,
                'office_id' => null,
                'action' => 'receipt.serial.update',
                'entity_type' => 'receipt_settings',
                'entity_id' => '1',
                'meta' => [
                    'old_data' => ['receipt_serial_start' => $oldStart],
                    'new_data' => ['receipt_serial_start' => $start],
                ],
            ]);
        } catch (\Throwable $e) {
            // Audit failure must never block the settings save.
        }

        return response()->json([
            'ok' => true,
            'receipt_serial_start' => $start,
            'old_receipt_serial_start' => $oldStart,
            'audit_logged' => true,
        ]);
    }

    private function defaultReceiptSettingsRow(?string $userId = null): array
    {
        return [
            'id' => 1,
            'language' => 'en',
            'paper_size' => 'a5',
            'accent_color' => '#1f4e79',
            'show_logo' => true,
            'show_signature_line' => true,
            'show_office' => true,
            'show_token_block' => true,
            'header_alignment' => 'center',
            'footer_note' => 'This is a system-generated receipt. Please retain for your records.',
            'footer_note_bn' => 'এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।',
            'show_watermark' => false,
            'watermark_text' => '',
            'show_penalty_row' => true,
            'show_charge_row' => true,
            'qr_placement' => 'right',
            'receipt_serial_start' => 0,
            'updated_by' => $userId,
            'updated_at' => now(),
        ];
    }

    /**
     * Supabase-compatible user administration endpoint used by the React
     * Users page (`db.functions.invoke('admin-users', ...)`) when the app is
     * running against the Laravel/VPS backend.
     */
    protected function fn_admin_users(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $actor) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $actorRoles = $actor->roleNames();
        $isDeveloper = in_array('developer', $actorRoles, true);
        $isSuper = $isDeveloper || in_array('super_admin', $actorRoles, true);
        if (! $isSuper) {
            return response()->json(['error' => 'Forbidden — developer/super admin only.'], 403);
        }

        $action = (string) $request->input('action', '');
        if ($action === '__healthcheck__') {
            return response()->json(['ok' => true]);
        }

        $requestId = (string) Str::uuid();
        try {
            return match ($action) {
                'list' => $this->adminUsersList($request, $isDeveloper, $isSuper),
                'failures' => $this->adminUsersFailures($request, $isDeveloper, $isSuper),
                'create' => $this->adminUsersCreate($request, $actor, $isDeveloper),
                'delete' => $this->adminUsersDelete($request, $actor, $isDeveloper),
                'reset_password' => $this->adminUsersResetPassword($request),
                'set_active' => $this->adminUsersSetActive($request, $actor, $isDeveloper),
                'update_profile' => $this->adminUsersUpdateProfile($request, $isDeveloper),
                'set_role' => $this->adminUsersSetRole($request, $actor, $isDeveloper),
                default => response()->json(['error' => 'Unknown action'], 400),
            };
        } catch (\Throwable $e) {
            $detail = [
                'request_id' => $requestId,
                'action' => $action,
                'actor_id' => $actor->id,
                'target_user_id' => (string) $request->input('user_id', ''),
                'role' => (string) $request->input('role', ''),
                'error' => $e->getMessage(),
            ];
            \Illuminate\Support\Facades\Log::error('admin-users action failed', $detail);
            // Durable, secured persistence of the failure for the admin failures view.
            $this->audit($actor, 'user.admin_failure', (string) $request->input('user_id', $requestId), $detail);
            return response()->json([
                'error' => 'Server error while processing admin-users request.',
                'request_id' => $requestId,
            ], 500);
        }
    }

    private function adminUsersList(Request $request, bool $isDeveloper = false, bool $isSuper = false): JsonResponse
    {
        // Developers and super admins bypass all office/role scoping and see every user.
        $scopeOffice = ($isDeveloper || $isSuper) ? null : $request->attributes->get('scope_office_id');
        $users = User::query()
            ->when($scopeOffice, fn ($query) => $query->where('office_id', $scopeOffice))
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->adminUserPayload($user))
            ->values();

        return response()->json(['ok' => true, 'users' => $users]);
    }

    /**
     * Secured view of persisted admin-users failures (developer/super admin only).
     */
    private function adminUsersFailures(Request $request, bool $isDeveloper, bool $isSuper): JsonResponse
    {
        if (! ($isDeveloper || $isSuper)) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $limit = min(200, max(1, (int) $request->input('limit', 50)));
        $rows = AuditLog::query()
            ->where('action', 'user.admin_failure')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'created_at' => optional($row->created_at)->toIso8601String(),
                'actor_id' => $row->user_id,
                'detail' => is_array($row->meta) ? $row->meta : (json_decode((string) $row->meta, true) ?? []),
            ])
            ->values();

        return response()->json(['ok' => true, 'failures' => $rows]);
    }



    private function adminUsersCreate(Request $request, User $actor, bool $isDeveloper): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => ['required', 'string', 'regex:/^[a-zA-Z0-9_.-]{3,30}$/', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'full_name' => ['required', 'string', 'max:191'],
            'role' => ['required', 'string', 'in:developer,super_admin,admin,committee,staff'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $data = $validator->validated();
        $role = $data['role'];
        if (in_array($role, ['developer', 'super_admin'], true) && ! $isDeveloper) {
            return response()->json(['error' => 'Only developers can create developer or super admin accounts.'], 403);
        }

        if (! in_array($role, ['developer', 'super_admin'], true) && empty($data['office_id'])) {
            return response()->json(['error' => 'Office is required for this role.'], 422);
        }

        return DB::transaction(function () use ($data, $role, $actor) {
            $user = User::create([
                'id' => (string) Str::uuid(),
                'username' => $data['username'],
                'name' => $data['full_name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'office_id' => in_array($role, ['developer', 'super_admin'], true) ? null : ($data['office_id'] ?? null),
                'is_active' => true,
            ]);

            $this->syncUserRole($user, $role);
            $this->syncProfile($user);
            $this->audit($actor, 'user.create', $user->id, ['role' => $role]);

            return response()->json(['ok' => true, 'user_id' => $user->id, 'user' => $this->adminUserPayload($user->refresh())], 201);
        });
    }

    private function adminUsersDelete(Request $request, User $actor, bool $isDeveloper): JsonResponse
    {
        $target = $this->findAdminTarget($request);
        if ($target->id === $actor->id) {
            return response()->json(['error' => 'You cannot delete yourself.'], 422);
        }
        if ($target->hasRole('developer') && ! $isDeveloper) {
            return response()->json(['error' => 'Only developers can delete developer accounts.'], 403);
        }

        $targetId = $target->id;
        return DB::transaction(function () use ($target, $targetId, $actor) {
            if (Schema::hasTable('profiles')) {
                DB::table('profiles')->where('id', $targetId)->delete();
            }
            $target->delete();
            $this->audit($actor, 'user.delete', $targetId);
            return response()->json(['ok' => true]);
        });
    }

    private function adminUsersResetPassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'string', 'exists:users,id'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }
        $target = User::query()->findOrFail($validator->validated()['user_id']);
        $target->update(['password' => Hash::make($validator->validated()['password'])]);
        $target->tokens()->delete();

        $this->audit($request->user(), 'user.password.reset', $target->id);
        return response()->json(['ok' => true]);
    }

    private function adminUsersSetActive(Request $request, User $actor, bool $isDeveloper): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'string', 'exists:users,id'],
            'is_active' => ['required', 'boolean'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }
        $data = $validator->validated();
        $target = User::query()->findOrFail($data['user_id']);
        if ($target->id === $actor->id) {
            return response()->json(['error' => 'You cannot change your own status.'], 422);
        }
        if ($target->hasRole('developer') && ! $isDeveloper) {
            return response()->json(['error' => 'Only developers can change developer accounts.'], 403);
        }

        $target->update(['is_active' => (bool) $data['is_active']]);
        $target->tokens()->delete();
        $this->syncProfile($target->refresh());
        $this->audit($actor, 'user.active', $target->id, ['is_active' => (bool) $data['is_active']]);

        return response()->json(['ok' => true]);
    }

    private function adminUsersUpdateProfile(Request $request, bool $isDeveloper): JsonResponse
    {
        $target = $this->findAdminTarget($request);
        if ($target->hasRole('developer') && ! $isDeveloper) {
            return response()->json(['error' => 'Only developers can edit developer accounts.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'username' => ['sometimes', 'string', 'regex:/^[a-zA-Z0-9_.-]{3,30}$/', 'unique:users,username,'.$target->id],
            'email' => ['sometimes', 'email', 'max:255', 'unique:users,email,'.$target->id],
            'full_name' => ['sometimes', 'string', 'max:191'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }

        $data = $validator->validated();
        $patch = [];
        if (array_key_exists('username', $data)) $patch['username'] = $data['username'];
        if (array_key_exists('email', $data)) $patch['email'] = $data['email'];
        if (array_key_exists('full_name', $data)) $patch['name'] = $data['full_name'];
        if ($request->has('office_id')) {
            $global = $target->hasRole('developer') || $target->hasRole('super_admin');
            $patch['office_id'] = $global ? null : $request->input('office_id');
        }
        if ($patch !== []) {
            $target->update($patch);
        }
        $this->syncProfile($target->refresh());
        $this->audit($request->user(), 'user.update', $target->id);

        return response()->json(['ok' => true, 'user' => $this->adminUserPayload($target)]);
    }

    private function adminUsersSetRole(Request $request, User $actor, bool $isDeveloper): JsonResponse
    {
        $target = $this->findAdminTarget($request);
        if ($target->id === $actor->id) {
            return response()->json(['error' => 'You cannot change your own role.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'role' => ['required', 'string', 'in:developer,super_admin,admin,committee,staff'],
        ]);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first()], 422);
        }
        $role = $validator->validated()['role'];

        if (($target->hasRole('developer') || in_array($role, ['developer', 'super_admin'], true)) && ! $isDeveloper) {
            return response()->json(['error' => 'Only developers can assign or change developer/super admin roles.'], 403);
        }

        return DB::transaction(function () use ($target, $role, $actor) {
            $this->syncUserRole($target, $role);
            if (in_array($role, ['developer', 'super_admin'], true)) {
                $target->update(['office_id' => null]);
            }
            $this->syncProfile($target->refresh());
            $this->audit($actor, 'user.role', $target->id, ['role' => $role]);
            return response()->json(['ok' => true, 'user' => $this->adminUserPayload($target)]);
        });
    }

    private function findAdminTarget(Request $request): User
    {
        $userId = (string) $request->input('user_id', '');
        if ($userId === '') {
            abort(422, 'Missing user_id.');
        }
        return User::query()->findOrFail($userId);
    }

    private function syncUserRole(User $user, string $roleName): void
    {
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            ['id' => (string) Str::uuid(), 'description' => ucfirst(str_replace('_', ' ', $roleName))],
        );

        if (Schema::hasColumn('user_roles', 'role_id')) {
            $user->roles()->sync([$role->id]);
            if (Schema::hasColumn('user_roles', 'role')) {
                DB::table('user_roles')->where('user_id', $user->id)->update(['role' => $roleName]);
            }
            return;
        }

        $row = ['user_id' => $user->id, 'role' => $roleName];
        if (Schema::hasColumn('user_roles', 'id')) $row['id'] = (string) Str::uuid();
        if (Schema::hasColumn('user_roles', 'created_at')) $row['created_at'] = now();
        if (Schema::hasColumn('user_roles', 'updated_at')) $row['updated_at'] = now();
        DB::table('user_roles')->where('user_id', $user->id)->delete();
        DB::table('user_roles')->insert($row);
    }

    private function syncProfile(User $user): void
    {
        if (! Schema::hasTable('profiles')) {
            return;
        }

        $row = [
            'id' => $user->id,
            'full_name' => $user->name,
            'email' => $user->email,
            'office_id' => $user->office_id,
            'username' => $user->username,
        ];
        if (Schema::hasColumn('profiles', 'language_pref')) $row['language_pref'] = 'bn';
        if (Schema::hasColumn('profiles', 'is_active')) $row['is_active'] = $user->is_active;
        if (Schema::hasColumn('profiles', 'updated_at')) $row['updated_at'] = now();
        if (! DB::table('profiles')->where('id', $user->id)->exists() && Schema::hasColumn('profiles', 'created_at')) {
            $row['created_at'] = now();
        }

        foreach (array_keys($row) as $column) {
            if (! Schema::hasColumn('profiles', $column)) {
                unset($row[$column]);
            }
        }

        DB::table('profiles')->updateOrInsert(['id' => $user->id], $row);
    }

    private function adminUserPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'full_name' => $user->name,
            'office_id' => $user->office_id,
            'is_active' => (bool) $user->is_active,
            'created_at' => optional($user->created_at)->toIso8601String(),
            'updated_at' => optional($user->updated_at)->toIso8601String(),
            'roles' => $user->roleNames(),
        ];
    }

    private function audit(?User $actor, string $action, string $targetId, array $meta = []): void
    {
        try {
            AuditLog::record([
                'user_id' => $actor?->id,
                'action' => $action,
                'entity_type' => 'user',
                'entity_id' => $targetId,
                'meta' => $meta,
            ]);
        } catch (\Throwable $e) {
            // Audit failure must never break user administration.
        }
    }

    /**
     * Data integrity scan — counts orphan / null farmer_id rows across the
     * key operational tables and reports ledger orphan references.
     * Mirrors the Supabase edge function `data-integrity-scan`.
     */
    protected function fn_data_integrity_scan(Request $request): JsonResponse
    {
        $safeNullCount = function (string $table) {
            try {
                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'farmer_id')) {
                    return 0;
                }
                return (int) DB::table($table)->whereNull('farmer_id')->count();
            } catch (\Throwable $e) {
                return 0;
            }
        };

        $sav_null  = $safeNullCount('savings_transactions');
        $loan_null = $safeNullCount('loans');
        $irr_null  = $safeNullCount('irrigation_charges');
        $pay_null  = $safeNullCount('payments');

        // Ledger orphan references — entries pointing at missing source rows.
        $ledgerOrphans = [];
        try {
            if (Schema::hasTable('ledger_entries')
                && Schema::hasColumn('ledger_entries', 'reference_id')
                && Schema::hasColumn('ledger_entries', 'reference_type')) {
                $rows = DB::table('ledger_entries')
                    ->select('reference_type', 'reference_id', DB::raw('COUNT(*) as entry_count'))
                    ->whereNotNull('reference_id')
                    ->groupBy('reference_type', 'reference_id')
                    ->limit(500)
                    ->get();

                $tableFor = [
                    'irrigation_invoice' => 'irrigation_invoices',
                    'irrigation_charge'  => 'irrigation_charges',
                    'loan'               => 'loans',
                    'loan_payment'       => 'loan_payments',
                    'savings'            => 'savings_transactions',
                    'payment'            => 'payments',
                    'expense'            => 'expenses',
                ];

                foreach ($rows as $r) {
                    $tbl = $tableFor[$r->reference_type] ?? null;
                    if (! $tbl || ! Schema::hasTable($tbl)) continue;
                    $exists = DB::table($tbl)->where('id', $r->reference_id)->exists();
                    if (! $exists) {
                        $ledgerOrphans[] = [
                            'reference_type' => $r->reference_type,
                            'reference_id'   => $r->reference_id,
                            'entry_count'    => (int) $r->entry_count,
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
            $ledgerOrphans = [];
        }

        $byType = [];
        foreach ($ledgerOrphans as $o) {
            $byType[$o['reference_type']] = ($byType[$o['reference_type']] ?? 0) + $o['entry_count'];
        }

        $total = $sav_null + $loan_null + $irr_null + $pay_null + count($ledgerOrphans);

        $report = [
            'generated_at' => now()->toIso8601String(),
            'summary' => [
                'savings_null_farmer'    => $sav_null,
                'loans_null_farmer'      => $loan_null,
                'irrigation_null_farmer' => $irr_null,
                'payments_null_farmer'   => $pay_null,
                'ledger_orphan_refs'     => count($ledgerOrphans),
                'total_issues'           => $total,
            ],
            'ledger_orphans_by_type' => $byType,
            'ledger_orphans'         => array_slice($ledgerOrphans, 0, 50),
            'healthy'                => $total === 0,
        ];

        return response()->json(['ok' => true, 'report' => $report]);
    }
}
