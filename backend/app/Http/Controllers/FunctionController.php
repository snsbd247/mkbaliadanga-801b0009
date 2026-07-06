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
