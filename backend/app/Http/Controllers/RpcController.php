<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * RPC dispatcher — a Laravel/MySQL replacement for Supabase Postgres
 * RPC functions (supabase.rpc(name, params)).
 *
 * The frontend `db.rpc(name, params)` adapter posts to /api/rpc/{name}
 * with the params as the JSON body. Each function below mirrors the
 * behaviour of the original Postgres function but in portable SQL/PHP.
 *
 * Authorisation is enforced by the route middleware (auth:sanctum +
 * branch.scope) — replacing Postgres RLS / SECURITY DEFINER checks.
 */
class RpcController extends Controller
{
    /**
     * RPCs the frontend depends on. Used by the contract endpoint to report
     * missing implementations clearly instead of failing at call time.
     */
    private const REQUIRED_RPCS = [
        'get_land_billing_split',
        'get_billed_farmer_for_land',
        'generate_invoice_no',
        'delete_payment_cascade',
    ];

    public function handle(Request $request, string $name): JsonResponse
    {
        $p = $request->all();
        $method = 'rpc_' . str_replace('-', '_', $name);

        if (! method_exists($this, $method)) {
            return response()->json([
                'message' => "RPC '$name' is not available on this server.",
            ], 501);
        }

        $result = $this->{$method}($p, $request);
        return response()->json(['result' => $result]);
    }

    /** List of implemented RPC names (without the rpc_ prefix). */
    public function availableRpcs(): array
    {
        $available = [];
        foreach (get_class_methods($this) as $m) {
            if (str_starts_with($m, 'rpc_')) {
                $available[] = substr($m, 4);
            }
        }
        sort($available);
        return $available;
    }

    /**
     * Pure contract evaluation — testable without an HTTP request. Reports the
     * available/required/missing RPC lists and whether the contract holds.
     */
    public function evaluateContract(?array $required = null): array
    {
        $required = $required ?? static::REQUIRED_RPCS;
        $available = $this->availableRpcs();

        $missing = array_values(array_filter(
            $required,
            fn ($name) => ! method_exists($this, 'rpc_' . $name)
        ));

        return [
            'available' => $available,
            'required'  => array_values($required),
            'missing'   => $missing,
            'ok'        => empty($missing),
            'message'   => empty($missing)
                ? 'All required RPCs are available.'
                : 'Missing required RPCs: ' . implode(', ', $missing),
        ];
    }

    /**
     * RPC contract validation — reports which RPCs are implemented on this
     * server and returns a clear error (409) when a required RPC is missing.
     */
    public function contract(Request $request): JsonResponse
    {
        $result = $this->evaluateContract();
        return response()->json($result, $result['ok'] ? 200 : 409);
    }



    // ── Farmer identifier helpers ─────────────────────────────────────
    private function normalizeIdentifier(?string $value): ?string
    {
        if ($value === null) return null;
        $digits = preg_replace('/\D/', '', $value);
        if ($digits === '' || $digits === null) return null;
        if (strlen($digits) >= 5) return substr($digits, -5);
        return str_pad($digits, 5, '0', STR_PAD_LEFT);
    }

    private function identifierExists(?string $candidate, ?string $excludeId): bool
    {
        if ($candidate === null) return false;

        $cols = array_values(array_filter(
            ['farmer_code', 'member_no', 'account_number', 'voter_number', 'code'],
            fn ($c) => Schema::hasColumn('farmers', $c)
        ));
        if (empty($cols)) return false;

        return DB::table('farmers')
            ->when($excludeId, fn ($q) => $q->where('id', '<>', $excludeId))
            ->where(function ($q) use ($candidate, $cols) {
                foreach ($cols as $i => $col) {
                    $i === 0 ? $q->where($col, $candidate) : $q->orWhere($col, $candidate);
                }
            })->exists();
    }


    private function generateFarmerAccountNumber(): string
    {
        for ($i = 1; $i <= 99999; $i++) {
            $candidate = str_pad((string) $i, 5, '0', STR_PAD_LEFT);
            if (! $this->identifierExists($candidate, null)) {
                return $candidate;
            }
        }
        abort(409, 'No available 5-digit farmer identifiers remain');
    }

    // ── RPCs ──────────────────────────────────────────────────────────
    protected function rpc_member_no_exists(array $p): bool
    {
        return $this->identifierExists(
            $this->normalizeIdentifier($p['_member_no'] ?? null),
            $p['_exclude_id'] ?? null,
        );
    }

    protected function rpc_email_for_username(array $p): ?string
    {
        $username = strtolower($p['_username'] ?? '');
        return DB::table('profiles')
            ->whereRaw('lower(username) = ?', [$username])
            ->value('email');
    }

    protected function rpc_generate_member_no(): string
    {
        return $this->generateFarmerAccountNumber();
    }

    protected function rpc_generate_account_number(): string
    {
        return $this->generateFarmerAccountNumber();
    }

    protected function rpc_generate_invoice_no(): string
    {
        $date = date('Ymd');
        $seq = DB::table('irrigation_invoices')
            ->where('invoice_no', 'like', "INV-$date-%")
            ->count() + 1;
        return 'INV-' . $date . '-' . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    private function billingAsOf(array $p): string
    {
        $asOf = (string) ($p['_as_of'] ?? $p['as_of'] ?? date('Y-m-d'));
        return preg_match('/^\d{4}-\d{2}-\d{2}/', $asOf) ? substr($asOf, 0, 10) : date('Y-m-d');
    }

    private function landBillingBase(?string $landId): ?array
    {
        if (! $landId || ! Schema::hasTable('lands')) {
            return null;
        }

        $land = DB::table('lands')->where('id', $landId)->first();
        if (! $land) {
            return null;
        }

        $owner = $land->owner_farmer_id ?? $land->farmer_id ?? null;
        if (! $owner) {
            return null;
        }

        return [
            'owner' => (string) $owner,
            'total' => (float) ($land->land_size ?? $land->area_decimal ?? 0),
        ];
    }

    /**
     * Laravel/MySQL mirror of Postgres RPC get_land_billing_split().
     * Splits a land bill between active borga sharecroppers and owner remainder.
     */
    protected function rpc_get_land_billing_split(array $p): array
    {
        $landId = $p['_land_id'] ?? $p['land_id'] ?? null;
        $asOf = $this->billingAsOf($p);
        $base = $this->landBillingBase($landId);
        if (! $base) {
            return [];
        }

        $rows = [];
        $allocated = 0.0;

        if (Schema::hasTable('land_relations')) {
            $relations = DB::table('land_relations')
                ->where('land_id', $landId);
            if (Schema::hasColumn('land_relations', 'deleted_at')) {
                $relations->whereNull('deleted_at');
            }
            if (Schema::hasColumn('land_relations', 'sharecropper_farmer_id')) {
                $relations->whereNotNull('sharecropper_farmer_id');
            }
            if (Schema::hasColumn('land_relations', 'valid_from')) {
                $relations->where(function ($q) use ($asOf) {
                    $q->whereNull('valid_from')->orWhere('valid_from', '<=', $asOf);
                });
            }
            if (Schema::hasColumn('land_relations', 'valid_to')) {
                $relations->where(function ($q) use ($asOf) {
                    $q->whereNull('valid_to')->orWhere('valid_to', '>=', $asOf);
                });
            }

            foreach ($relations->get() as $relation) {
                $sharecropper = $relation->sharecropper_farmer_id ?? null;
                if (! $sharecropper) {
                    continue;
                }
                $area = (float) ($relation->area_decimal ?? 0);
                if ($area <= 0) {
                    $area = $base['total'] * ((float) ($relation->share_percentage ?? 0)) / 100.0;
                }
                if ($area <= 0) {
                    continue;
                }
                $allocated += $area;
                $rows[] = [
                    'farmer_id' => (string) $sharecropper,
                    'owner_farmer_id' => $base['owner'],
                    'is_borga' => true,
                    'billed_area' => round($area, 4),
                ];
            }
        }

        $remaining = $base['total'] - $allocated;
        if ($allocated <= 0 || $remaining > 0.0001) {
            $rows[] = [
                'farmer_id' => $base['owner'],
                'owner_farmer_id' => $base['owner'],
                'is_borga' => false,
                'billed_area' => round(max($remaining, 0), 4),
            ];
        }

        return $rows;
    }

    /** Laravel/MySQL mirror of Postgres RPC get_billed_farmer_for_land(). */
    protected function rpc_get_billed_farmer_for_land(array $p): ?array
    {
        $rows = $this->rpc_get_land_billing_split($p);
        if (empty($rows)) {
            return null;
        }

        $row = collect($rows)->firstWhere('is_borga', true) ?? $rows[0];
        return [
            'farmer_id' => $row['farmer_id'],
            'owner_farmer_id' => $row['owner_farmer_id'],
            'is_borga' => (bool) $row['is_borga'],
        ];
    }

    protected function rpc_count_farmer_invoices(array $p): int
    {
        $q = DB::table('irrigation_invoices')->where('farmer_id', $p['_farmer_id'] ?? null);
        if (Schema::hasColumn('irrigation_invoices', 'deleted_at')) {
            $q->whereNull('deleted_at');
        }
        if (Schema::hasColumn('irrigation_invoices', 'invoice_status')) {
            $q->where('invoice_status', '<>', 'cancelled');
        } elseif (Schema::hasColumn('irrigation_invoices', 'status')) {
            $q->where('status', '<>', 'cancelled');
        }

        return $q->count();
    }

    /** Tables that represent real activity/transactions for a farmer. */
    private const FARMER_TXN_TABLES = [
        'irrigation_invoice_payments', 'irrigation_invoice_audit', 'irrigation_delay_fee_audit',
        'irrigation_rate_overrides', 'irrigation_sms_logs', 'irrigation_due_promises',
        'irrigation_charges', 'irrigation_invoices',
        'savings_transactions', 'savings_accounts', 'savings_yearly_opening',
        'loan_installment_delay_audit', 'loan_discount_audit', 'loan_installments',
        'loan_payments', 'loan_repayments', 'loan_guarantors', 'loans',
        'payment_allocations', 'payments', 'receipts', 'public_payment_intents',
        'shares', 'office_incomes',
        'land_note_attachments', 'land_note_audit', 'land_change_log',
        'land_relations', 'land_transfer_recipients', 'land_transfers', 'land_history', 'lands',
        'ledger_entries', 'journal_entry_lines', 'journal_lines', 'journal_entries', 'vouchers',
        'member_block_audit', 'voter_audit_logs',
    ];

    private const FARMER_TXN_LABELS = [
        'irrigation_invoices' => 'সেচ ইনভয়েস',
        'irrigation_charges' => 'সেচ চার্জ',
        'irrigation_invoice_payments' => 'সেচ পেমেন্ট',
        'irrigation_invoice_audit' => 'সেচ ইনভয়েস অডিট',
        'irrigation_delay_fee_audit' => 'সেচ জরিমানা অডিট',
        'irrigation_rate_overrides' => 'সেচ রেট পরিবর্তন',
        'irrigation_sms_logs' => 'সেচ এসএমএস লগ',
        'irrigation_due_promises' => 'সেচ বকেয়া প্রতিশ্রুতি',
        'savings_transactions' => 'সঞ্চয় লেনদেন',
        'savings_accounts' => 'সঞ্চয় হিসাব',
        'savings_yearly_opening' => 'সঞ্চয় ওপেনিং ব্যালেন্স',
        'loans' => 'ঋণ',
        'loan_installment_delay_audit' => 'ঋণ কিস্তি জরিমানা অডিট',
        'loan_discount_audit' => 'ঋণ ডিসকাউন্ট অডিট',
        'loan_installments' => 'ঋণ কিস্তি',
        'loan_payments' => 'ঋণ পরিশোধ',
        'loan_repayments' => 'ঋণ পরিশোধ',
        'loan_guarantors' => 'ঋণ জামিনদার',
        'payment_allocations' => 'পেমেন্ট বরাদ্দ',
        'payments' => 'পেমেন্ট',
        'shares' => 'শেয়ার',
        'office_incomes' => 'বিবিধ আদায়',
        'lands' => 'জমি',
        'land_note_attachments' => 'জমির নোট সংযুক্তি',
        'land_note_audit' => 'জমির নোট অডিট',
        'land_change_log' => 'জমি পরিবর্তন লগ',
        'land_relations' => 'জমির সম্পর্ক',
        'land_transfer_recipients' => 'জমি হস্তান্তর গ্রহীতা',
        'land_transfers' => 'জমি হস্তান্তর',
        'land_history' => 'জমির ইতিহাস',
        'receipts' => 'রশিদ',
        'public_payment_intents' => 'পাবলিক পেমেন্ট অনুরোধ',
        'ledger_entries' => 'লেজার এন্ট্রি',
        'journal_entry_lines' => 'জার্নাল লাইন',
        'journal_lines' => 'জার্নাল লাইন',
        'journal_entries' => 'জার্নাল এন্ট্রি',
        'vouchers' => 'ভাউচার',
        'member_block_audit' => 'মেম্বার ব্লক অডিট',
        'voter_audit_logs' => 'ভোটার অডিট লগ',
    ];

    /** Normalize an array of scalar values for whereIn queries. */
    private function values(array $values): array
    {
        return array_values(array_unique(array_filter($values, fn ($v) => $v !== null && $v !== '')));
    }

    private function addCtx(array &$ctx, string $key, array $values): void
    {
        $ctx[$key] = $this->values(array_merge($ctx[$key] ?? [], $values));
    }

    private function queryMatching(string $table, array $criteria): ?\Illuminate\Database\Query\Builder
    {
        if (! Schema::hasTable($table)) {
            return null;
        }

        $valid = [];
        foreach ($criteria as $column => $values) {
            $values = $this->values(is_array($values) ? $values : [$values]);
            if (! empty($values) && Schema::hasColumn($table, $column)) {
                $valid[$column] = $values;
            }
        }

        if (empty($valid)) {
            return null;
        }

        return DB::table($table)->where(function ($q) use ($valid) {
            foreach ($valid as $column => $values) {
                $q->orWhereIn($column, $values);
            }
        });
    }

    private function countMatching(string $table, array $criteria): int
    {
        $q = $this->queryMatching($table, $criteria);
        return $q ? $q->count() : 0;
    }

    private function deleteMatching(string $table, array $criteria): int
    {
        $q = $this->queryMatching($table, $criteria);
        return $q ? $q->delete() : 0;
    }

    private function pluckIdsMatching(string $table, array $criteria): array
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'id')) {
            return [];
        }
        $q = $this->queryMatching($table, $criteria);
        return $q ? $this->values($q->pluck('id')->all()) : [];
    }

    private function pluckColumnMatching(string $table, string $column, array $criteria): array
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return [];
        }
        $q = $this->queryMatching($table, $criteria);
        return $q ? $this->values($q->pluck($column)->all()) : [];
    }

    private function farmerIdentityValues(?object $farmer): array
    {
        if (! $farmer) {
            return [];
        }

        return $this->values([
            $farmer->farmer_code ?? null,
            $farmer->member_no ?? null,
            $farmer->account_number ?? null,
            $farmer->voter_number ?? null,
            $farmer->code ?? null,
            $farmer->phone ?? null,
            $farmer->mobile ?? null,
        ]);
    }

    /** Collect every known direct/indirect record id related to a farmer. */
    private function farmerCascadeContext(string $farmerId, ?object $farmer = null): array
    {
        $farmer ??= Schema::hasTable('farmers') ? DB::table('farmers')->where('id', $farmerId)->first() : null;
        $ctx = ['farmers' => [$farmerId]];
        $identityValues = $this->farmerIdentityValues($farmer);

        foreach ([
            'loans', 'savings_accounts', 'irrigation_invoices', 'payments', 'receipts',
            'lands', 'shares', 'savings_yearly_opening', 'office_incomes',
            'irrigation_charges', 'irrigation_due_promises', 'irrigation_sms_logs',
            'member_block_audit', 'voter_audit_logs',
        ] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, ['farmer_id' => [$farmerId]]));
        }

        $this->addCtx($ctx, 'land_relations', $this->pluckIdsMatching('land_relations', [
            'owner_farmer_id' => [$farmerId],
            'sharecropper_farmer_id' => [$farmerId],
            'land_id' => $ctx['lands'] ?? [],
        ]));
        $this->addCtx($ctx, 'land_transfers', $this->pluckIdsMatching('land_transfers', [
            'source_farmer_id' => [$farmerId],
            'source_land_id' => $ctx['lands'] ?? [],
        ]));
        $this->addCtx($ctx, 'land_transfer_recipients', $this->pluckIdsMatching('land_transfer_recipients', [
            'recipient_farmer_id' => [$farmerId],
            'new_land_id' => $ctx['lands'] ?? [],
            'transfer_id' => $ctx['land_transfers'] ?? [],
        ]));

        foreach (['land_history', 'land_change_log', 'land_note_attachments', 'land_note_audit'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'farmer_id' => [$farmerId],
                'cultivator_farmer_id' => [$farmerId],
                'land_id' => $ctx['lands'] ?? [],
            ]));
        }

        foreach (['loan_payments', 'loan_repayments', 'loan_installments', 'loan_guarantors', 'loan_discount_audit'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'farmer_id' => [$farmerId],
                'loan_id' => $ctx['loans'] ?? [],
            ]));
        }
        $this->addCtx($ctx, 'loan_installment_delay_audit', $this->pluckIdsMatching('loan_installment_delay_audit', [
            'loan_id' => $ctx['loans'] ?? [],
            'installment_id' => $ctx['loan_installments'] ?? [],
        ]));

        $this->addCtx($ctx, 'savings_transactions', $this->pluckIdsMatching('savings_transactions', [
            'farmer_id' => [$farmerId],
            'account_id' => $ctx['savings_accounts'] ?? [],
        ]));

        foreach (['irrigation_invoice_payments', 'irrigation_invoice_audit', 'irrigation_delay_fee_audit', 'irrigation_rate_overrides'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'farmer_id' => [$farmerId],
                'invoice_id' => $ctx['irrigation_invoices'] ?? [],
                'irrigation_invoice_id' => $ctx['irrigation_invoices'] ?? [],
            ]));
        }

        $this->addCtx($ctx, 'payments', $this->pluckColumnMatching('payment_allocations', 'payment_id', [
            'target_id' => $this->relatedEntityIds($ctx),
        ]));
        $this->addCtx($ctx, 'payments', $this->pluckColumnMatching('irrigation_invoice_payments', 'payment_id', [
            'invoice_id' => $ctx['irrigation_invoices'] ?? [],
        ]));
        $this->addCtx($ctx, 'payments', $this->pluckColumnMatching('loan_payments', 'payment_id', [
            'loan_id' => $ctx['loans'] ?? [],
        ]));

        foreach (['payment_allocations', 'irrigation_delay_fee_audit', 'irrigation_due_promises', 'loan_installment_delay_audit', 'loan_discount_audit'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'payment_id' => $ctx['payments'] ?? [],
                'target_id' => $this->relatedEntityIds($ctx),
            ]));
        }

        $relatedIds = $this->relatedEntityIds($ctx);
        $this->addCtx($ctx, 'receipts', $this->pluckIdsMatching('receipts', [
            'farmer_id' => [$farmerId],
            'reference_id' => $relatedIds,
            'link_id' => $relatedIds,
        ]));
        $this->addCtx($ctx, 'public_payment_intents', $this->pluckIdsMatching('public_payment_intents', [
            'payment_id' => $ctx['payments'] ?? [],
            'farmer_id' => [$farmerId],
            'farmer_code' => $identityValues,
        ]));

        $relatedIds = $this->relatedEntityIds($ctx);
        foreach (['ledger_entries', 'vouchers'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'reference_id' => $relatedIds,
                'source_id' => $relatedIds,
            ]));
        }
        $this->addCtx($ctx, 'journal_entries', $this->pluckIdsMatching('journal_entries', [
            'source_id' => $relatedIds,
        ]));
        foreach (['journal_lines', 'journal_entry_lines'] as $table) {
            $this->addCtx($ctx, $table, $this->pluckIdsMatching($table, [
                'entry_id' => $ctx['journal_entries'] ?? [],
                'journal_id' => $ctx['journal_entries'] ?? [],
            ]));
        }

        return $ctx;
    }

    private function relatedEntityIds(array $ctx): array
    {
        $ids = [];
        foreach ($ctx as $table => $tableIds) {
            if ($table === 'farmers') {
                continue;
            }
            $ids = array_merge($ids, $tableIds);
        }
        return $this->values($ids);
    }

    /** Child-first delete/count plan. All criteria are OR-ed and missing columns are ignored. */
    private function farmerCascadePlan(string $farmerId, array $ctx, ?object $farmer = null): array
    {
        $relatedIds = $this->relatedEntityIds($ctx);
        $identityValues = $this->farmerIdentityValues($farmer);

        return [
            'journal_lines' => ['id' => $ctx['journal_lines'] ?? [], 'entry_id' => $ctx['journal_entries'] ?? []],
            'journal_entry_lines' => ['id' => $ctx['journal_entry_lines'] ?? [], 'journal_id' => $ctx['journal_entries'] ?? []],
            'payment_allocations' => ['id' => $ctx['payment_allocations'] ?? [], 'payment_id' => $ctx['payments'] ?? [], 'target_id' => $relatedIds],
            'land_transfer_recipients' => ['id' => $ctx['land_transfer_recipients'] ?? [], 'recipient_farmer_id' => [$farmerId], 'new_land_id' => $ctx['lands'] ?? [], 'transfer_id' => $ctx['land_transfers'] ?? []],
            'land_note_attachments' => ['id' => $ctx['land_note_attachments'] ?? [], 'land_id' => $ctx['lands'] ?? []],
            'land_note_audit' => ['id' => $ctx['land_note_audit'] ?? [], 'land_id' => $ctx['lands'] ?? []],
            'land_change_log' => ['id' => $ctx['land_change_log'] ?? [], 'farmer_id' => [$farmerId], 'land_id' => $ctx['lands'] ?? []],
            'irrigation_invoice_payments' => ['id' => $ctx['irrigation_invoice_payments'] ?? [], 'invoice_id' => $ctx['irrigation_invoices'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'irrigation_invoice_audit' => ['id' => $ctx['irrigation_invoice_audit'] ?? [], 'invoice_id' => $ctx['irrigation_invoices'] ?? []],
            'irrigation_delay_fee_audit' => ['id' => $ctx['irrigation_delay_fee_audit'] ?? [], 'invoice_id' => $ctx['irrigation_invoices'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'irrigation_rate_overrides' => ['id' => $ctx['irrigation_rate_overrides'] ?? [], 'irrigation_invoice_id' => $ctx['irrigation_invoices'] ?? []],
            'irrigation_sms_logs' => ['id' => $ctx['irrigation_sms_logs'] ?? [], 'farmer_id' => [$farmerId], 'irrigation_invoice_id' => $ctx['irrigation_invoices'] ?? []],
            'irrigation_due_promises' => ['id' => $ctx['irrigation_due_promises'] ?? [], 'farmer_id' => [$farmerId], 'payment_id' => $ctx['payments'] ?? []],
            'loan_installment_delay_audit' => ['id' => $ctx['loan_installment_delay_audit'] ?? [], 'installment_id' => $ctx['loan_installments'] ?? [], 'loan_id' => $ctx['loans'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'loan_discount_audit' => ['id' => $ctx['loan_discount_audit'] ?? [], 'loan_id' => $ctx['loans'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'loan_installments' => ['id' => $ctx['loan_installments'] ?? [], 'loan_id' => $ctx['loans'] ?? []],
            'loan_payments' => ['id' => $ctx['loan_payments'] ?? [], 'loan_id' => $ctx['loans'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'loan_repayments' => ['id' => $ctx['loan_repayments'] ?? [], 'loan_id' => $ctx['loans'] ?? [], 'payment_id' => $ctx['payments'] ?? []],
            'loan_guarantors' => ['id' => $ctx['loan_guarantors'] ?? [], 'loan_id' => $ctx['loans'] ?? [], 'farmer_id' => [$farmerId]],
            'savings_transactions' => ['id' => $ctx['savings_transactions'] ?? [], 'account_id' => $ctx['savings_accounts'] ?? [], 'farmer_id' => [$farmerId]],
            'ledger_entries' => ['id' => $ctx['ledger_entries'] ?? [], 'reference_id' => $relatedIds],
            'journal_entries' => ['id' => $ctx['journal_entries'] ?? [], 'source_id' => $relatedIds],
            'vouchers' => ['id' => $ctx['vouchers'] ?? [], 'reference_id' => $relatedIds],
            'receipts' => ['id' => $ctx['receipts'] ?? [], 'farmer_id' => [$farmerId], 'reference_id' => $relatedIds, 'link_id' => $relatedIds],
            'public_payment_intents' => ['id' => $ctx['public_payment_intents'] ?? [], 'payment_id' => $ctx['payments'] ?? [], 'farmer_id' => [$farmerId], 'farmer_code' => $identityValues],
            'member_block_audit' => ['id' => $ctx['member_block_audit'] ?? [], 'farmer_id' => [$farmerId]],
            'voter_audit_logs' => ['id' => $ctx['voter_audit_logs'] ?? [], 'farmer_id' => [$farmerId]],
            'irrigation_charges' => ['id' => $ctx['irrigation_charges'] ?? [], 'farmer_id' => [$farmerId], 'land_id' => $ctx['lands'] ?? []],
            'irrigation_invoices' => ['id' => $ctx['irrigation_invoices'] ?? [], 'farmer_id' => [$farmerId], 'land_id' => $ctx['lands'] ?? []],
            'savings_yearly_opening' => ['id' => $ctx['savings_yearly_opening'] ?? [], 'farmer_id' => [$farmerId]],
            'savings_accounts' => ['id' => $ctx['savings_accounts'] ?? [], 'farmer_id' => [$farmerId]],
            'loans' => ['id' => $ctx['loans'] ?? [], 'farmer_id' => [$farmerId]],
            'shares' => ['id' => $ctx['shares'] ?? [], 'farmer_id' => [$farmerId]],
            'payments' => ['id' => $ctx['payments'] ?? [], 'farmer_id' => [$farmerId]],
            'office_incomes' => ['id' => $ctx['office_incomes'] ?? [], 'farmer_id' => [$farmerId]],
            'land_history' => ['id' => $ctx['land_history'] ?? [], 'farmer_id' => [$farmerId], 'cultivator_farmer_id' => [$farmerId], 'land_id' => $ctx['lands'] ?? []],
            'land_relations' => ['id' => $ctx['land_relations'] ?? [], 'land_id' => $ctx['lands'] ?? [], 'owner_farmer_id' => [$farmerId], 'sharecropper_farmer_id' => [$farmerId]],
            'land_transfers' => ['id' => $ctx['land_transfers'] ?? [], 'source_farmer_id' => [$farmerId], 'source_land_id' => $ctx['lands'] ?? []],
            'lands' => ['id' => $ctx['lands'] ?? [], 'farmer_id' => [$farmerId]],
        ];
    }

    private function isDeveloperUser($user): bool
    {
        if (! $user) {
            return false;
        }

        try {
            if (method_exists($user, 'hasRole') && $user->hasRole('developer')) {
                return true;
            }
            if (isset($user->id) && Schema::hasTable('roles') && Schema::hasTable('user_roles')) {
                $hasRole = DB::table('roles')
                    ->join('user_roles', 'user_roles.role_id', '=', 'roles.id')
                    ->where('user_roles.user_id', $user->id)
                    ->where('roles.name', 'developer')
                    ->exists();
                if ($hasRole) {
                    return true;
                }
            }
        } catch (\Throwable $e) {
            // Fall through to the canonical username guard below.
        }

        // Canonical VPS developer account. This keeps the destructive tool usable
        // even if a stale deployment briefly fails to hydrate the role relation.
        return strtolower((string) ($user->username ?? '')) === 'ismail162';
    }

    /** Count blocking transactional records for a farmer, keyed by table. */
    private function farmerBlockingCounts(string $farmerId): array
    {
        $blocking = [];
        $farmer = Schema::hasTable('farmers') ? DB::table('farmers')->where('id', $farmerId)->first() : null;
        $ctx = $this->farmerCascadeContext($farmerId, $farmer);
        foreach ($this->farmerCascadePlan($farmerId, $ctx, $farmer) as $tbl => $criteria) {
            $count = $this->countMatching($tbl, $criteria);
            if ($count > 0) {
                $blocking[$tbl] = $count;
            }
        }
        return $blocking;
    }

    /** Build a Bengali summary list and message from a blocking map. */
    private function farmerBlockingDetails(array $blocking): array
    {
        $items = [];
        $parts = [];
        foreach ($blocking as $tbl => $count) {
            $name = self::FARMER_TXN_LABELS[$tbl] ?? $tbl;
            $items[] = ['table' => $tbl, 'label' => $name, 'count' => $count];
            $parts[] = "$name ($count)";
        }
        return [$items, implode(', ', $parts)];
    }

    private function logFarmerDeletion(Request $request, ?string $farmerId, string $status, array $blocking, ?string $reason, ?object $farmer = null): void
    {
        try {
            if (! Schema::hasTable('farmer_deletion_logs')) {
                return;
            }
            $user = $request->user();
            DB::table('farmer_deletion_logs')->insert([
                'id'          => (string) Str::uuid(),
                'farmer_id'   => $farmerId,
                'farmer_name' => $farmer->name ?? $farmer->name_bn ?? $farmer->name_en ?? null,
                'farmer_code' => $farmer->farmer_code ?? $farmer->member_no ?? $farmer->code ?? null,
                'office_id'   => $farmer->office_id ?? null,
                'user_id'     => $user->id ?? null,
                'user_name'   => $user->full_name ?? $user->name ?? $user->email ?? null,
                'status'      => $status,
                'blocking'    => empty($blocking) ? null : json_encode($blocking),
                'reason'      => $reason,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            // Audit failures must never break the caller.
        }
    }

    /**
     * Dry-run precheck: count blocking transactional records for a farmer
     * WITHOUT deleting anything. Used by the UI before showing the delete action.
     */
    protected function rpc_farmer_delete_precheck(array $p, Request $request): array
    {
        $farmerId = $p['_farmer_id'] ?? $p['farmer_id'] ?? null;
        if (! $farmerId) {
            return ['ok' => false, 'reason' => 'missing_id', 'message' => 'ফার্মার আইডি পাওয়া যায়নি।'];
        }

        $blocking = $this->farmerBlockingCounts($farmerId);
        [$items, $summary] = $this->farmerBlockingDetails($blocking);
        $total = array_sum($blocking);
        $isDeveloper = $this->isDeveloperUser($request->user());

        return [
            'ok'           => true,
            'farmer_id'    => $farmerId,
            'can_delete'   => empty($blocking),
            'can_cascade'  => $isDeveloper,
            'blocking'     => $blocking,
            'items'        => $items,
            'total'        => $total,
            'message'      => empty($blocking)
                ? 'কোনো ট্রানজেকশন নেই — পারমানেন্ট ডিলিট করা যাবে।'
                : 'ব্লকিং রেকর্ড পাওয়া গেছে: ' . $summary . '।',
        ];
    }

    /**
     * Permanently delete a farmer from the database, but ONLY when the farmer
     * has no transactional records. Returns a status payload the frontend can
     * use to show a clear message. Logs every attempt (success or blocked).
     */
    protected function rpc_farmer_permanent_delete(array $p, Request $request): array
    {
        $farmerId = $p['_farmer_id'] ?? $p['farmer_id'] ?? null;
        if (! $farmerId) {
            return ['ok' => false, 'reason' => 'missing_id', 'message' => 'ফার্মার আইডি পাওয়া যায়নি।'];
        }

        $farmer = DB::table('farmers')->where('id', $farmerId)->first();
        if (! $farmer) {
            return ['ok' => false, 'reason' => 'not_found', 'message' => 'ফার্মারটি ডাটাবেজে পাওয়া যায়নি।'];
        }

        $cascade = (bool) ($p['_cascade'] ?? $p['cascade'] ?? false);
        $user = $request->user();
        $isDeveloper = $this->isDeveloperUser($user);

        $blocking = $this->farmerBlockingCounts($farmerId);

        // Cascade delete: developer role only — wipes the farmer AND every
        // related transactional record in a single atomic operation.
        if ($cascade) {
            if (! $isDeveloper) {
                $message = 'ক্যাসকেড পারমানেন্ট ডিলিট শুধুমাত্র ডেভেলপার রোলের ইউজার করতে পারবেন।';
                $this->logFarmerDeletion($request, $farmerId, 'blocked', $blocking, $message, $farmer);
                return ['ok' => false, 'reason' => 'forbidden', 'message' => $message];
            }

            try {
                $deletedCounts = [];
                DB::transaction(function () use ($farmerId, $farmer, &$deletedCounts) {
                    $ctx = $this->farmerCascadeContext($farmerId, $farmer);
                    foreach ($this->farmerCascadePlan($farmerId, $ctx, $farmer) as $tbl => $criteria) {
                        $deleted = $this->deleteMatching($tbl, $criteria);
                        if ($deleted > 0) {
                            $deletedCounts[$tbl] = $deleted;
                        }
                    }
                    DB::table('farmers')->where('id', $farmerId)->delete();
                });
            } catch (\Throwable $e) {
                $message = 'ক্যাসকেড ডিলিট ব্যর্থ হয়েছে: ' . $e->getMessage();
                $this->logFarmerDeletion($request, $farmerId, 'blocked', $blocking, $message, $farmer);
                return ['ok' => false, 'reason' => 'cascade_failed', 'message' => $message];
            }

            $this->logFarmerDeletion($request, $farmerId, 'deleted', $deletedCounts ?: $blocking, 'cascade', $farmer);
            return [
                'ok' => true,
                'cascade' => true,
                'deleted' => $deletedCounts,
                'message' => 'ফার্মার এবং তার সকল ট্রানজেকশন পারমানেন্টভাবে ডিলিট করা হয়েছে।',
            ];
        }

        if (! empty($blocking)) {
            [, $summary] = $this->farmerBlockingDetails($blocking);
            $message = 'এই ফার্মারের নিম্নলিখিত রেকর্ড থাকায় পারমানেন্ট ডিলিট করা যাবে না: ' . $summary . '।';
            $this->logFarmerDeletion($request, $farmerId, 'blocked', $blocking, $message, $farmer);
            return [
                'ok' => false,
                'reason' => 'has_transactions',
                'blocking' => $blocking,
                'message' => $message,
            ];
        }

        DB::table('farmers')->where('id', $farmerId)->delete();
        $this->logFarmerDeletion($request, $farmerId, 'deleted', [], null, $farmer);

        return ['ok' => true, 'message' => 'ফার্মার পারমানেন্টভাবে ডিলিট করা হয়েছে।'];
    }

    /** Admin report: list of permanently-deleted farmers (and blocked attempts). */
    protected function rpc_deleted_farmers_list(array $p): array
    {
        if (! Schema::hasTable('farmer_deletion_logs')) {
            return [];
        }
        $q = DB::table('farmer_deletion_logs')->orderByDesc('created_at');
        $status = $p['_status'] ?? null;
        if ($status) {
            $q->where('status', $status);
        }
        $limit = min((int) ($p['_limit'] ?? 200), 1000);
        return $q->limit($limit)->get()->map(function ($r) {
            $r->blocking = $r->blocking ? json_decode($r->blocking, true) : null;
            return (array) $r;
        })->toArray();
    }




    protected function rpc_farmer_dues_summary(array $p, Request $request): array
    {
        if (! Schema::hasTable('farmers')) {
            return [];
        }

        $farmers = DB::table('farmers')->select('id');
        if (Schema::hasColumn('farmers', 'deleted_at')) {
            $farmers->whereNull('deleted_at');
        }
        $officeId = $request->attributes->get('scope_office_id');
        if (! $request->attributes->get('is_super_admin') && $officeId && Schema::hasColumn('farmers', 'office_id')) {
            $farmers->where('office_id', $officeId);
        }

        $summary = [];
        foreach ($farmers->pluck('id') as $id) {
            $summary[$id] = [
                'farmer_id' => $id,
                'loan_due' => 0.0,
                'irr_due' => 0.0,
                'savings_bal' => 0.0,
                'net_due' => 0.0,
            ];
        }

        if (Schema::hasTable('loans') && Schema::hasColumn('loans', 'farmer_id')) {
            $loanDueExpr = Schema::hasColumn('loans', 'total_payable')
                ? 'GREATEST(COALESCE(total_payable,0) - COALESCE(SUM_PAID,0), 0)'
                : (Schema::hasColumn('loans', 'outstanding') ? 'GREATEST(COALESCE(outstanding,0), 0)' : 'GREATEST(COALESCE(principal,0), 0)');

            if (Schema::hasTable('loan_payments') && Schema::hasColumn('loan_payments', 'loan_id')) {
                $paidSub = DB::table('loan_payments')
                    ->select('loan_id', DB::raw('COALESCE(SUM(amount),0) as paid'))
                    ->groupBy('loan_id');
                $loans = DB::table('loans')
                    ->leftJoinSub($paidSub, 'lp', 'lp.loan_id', '=', 'loans.id')
                    ->select('loans.farmer_id', DB::raw('COALESCE(SUM('.str_replace('SUM_PAID', 'lp.paid', $loanDueExpr).'),0) as due'));
            } elseif (Schema::hasTable('loan_repayments') && Schema::hasColumn('loan_repayments', 'loan_id')) {
                $paidSub = DB::table('loan_repayments')
                    ->select('loan_id', DB::raw('COALESCE(SUM(amount),0) as paid'))
                    ->groupBy('loan_id');
                $loans = DB::table('loans')
                    ->leftJoinSub($paidSub, 'lr', 'lr.loan_id', '=', 'loans.id')
                    ->select('loans.farmer_id', DB::raw('COALESCE(SUM('.str_replace('SUM_PAID', 'lr.paid', $loanDueExpr).'),0) as due'));
            } else {
                $loans = DB::table('loans')
                    ->select('farmer_id', DB::raw('COALESCE(SUM('.str_replace('SUM_PAID', '0', $loanDueExpr).'),0) as due'));
            }
            if (Schema::hasColumn('loans', 'deleted_at')) {
                $loans->whereNull('loans.deleted_at');
            }
            if (Schema::hasColumn('loans', 'status')) {
                $loans->whereIn('loans.status', ['approved', 'active', 'defaulted']);
            }
            foreach ($loans->groupBy('loans.farmer_id')->get() as $row) {
                if (isset($summary[$row->farmer_id])) {
                    $summary[$row->farmer_id]['loan_due'] = (float) $row->due;
                }
            }
        }

        $irrigationTable = Schema::hasTable('irrigation_charges') ? 'irrigation_charges' : (Schema::hasTable('irrigation_invoices') ? 'irrigation_invoices' : null);
        if ($irrigationTable && Schema::hasColumn($irrigationTable, 'farmer_id')) {
            $amountCol = Schema::hasColumn($irrigationTable, 'due_amount') ? 'due_amount' : (Schema::hasColumn($irrigationTable, 'amount') ? 'amount' : null);
            if ($amountCol) {
                $ir = DB::table($irrigationTable)
                    ->select('farmer_id', DB::raw("COALESCE(SUM($amountCol),0) as due"));
                if (Schema::hasColumn($irrigationTable, 'deleted_at')) {
                    $ir->whereNull('deleted_at');
                }
                foreach ($ir->groupBy('farmer_id')->get() as $row) {
                    if (isset($summary[$row->farmer_id])) {
                        $summary[$row->farmer_id]['irr_due'] = (float) $row->due;
                    }
                }
            }
        }

        if (Schema::hasTable('savings_transactions') && Schema::hasColumn('savings_transactions', 'farmer_id') && Schema::hasColumn('savings_transactions', 'amount')) {
            $sv = DB::table('savings_transactions')->select('farmer_id');
            if (Schema::hasColumn('savings_transactions', 'type')) {
                $sv->selectRaw("COALESCE(SUM(CASE WHEN type IN ('deposit','credit') THEN amount WHEN type IN ('withdraw','withdrawal','debit') THEN -amount ELSE 0 END),0) as bal");
            } else {
                $sv->selectRaw('COALESCE(SUM(amount),0) as bal');
            }
            if (Schema::hasColumn('savings_transactions', 'deleted_at')) {
                $sv->whereNull('deleted_at');
            }
            if (Schema::hasColumn('savings_transactions', 'status')) {
                $sv->where('status', 'approved');
            }
            foreach ($sv->groupBy('farmer_id')->get() as $row) {
                if (isset($summary[$row->farmer_id])) {
                    $summary[$row->farmer_id]['savings_bal'] = (float) $row->bal;
                }
            }
        }

        foreach ($summary as &$row) {
            $row['net_due'] = max(($row['loan_due'] + $row['irr_due']) - $row['savings_bal'], 0);
        }
        unset($row);

        return array_values($summary);
    }

    protected function rpc_list_collector_users(array $p, Request $request): array
    {
        $user = $request->user();
        $q = DB::table('profiles')->select('id', 'full_name', 'email', 'office_id');
        $isSuper = $user && method_exists($user, 'hasRole') ? $user->hasRole('super_admin') : false;
        if (! $isSuper && $user) {
            $q->where('office_id', $user->office_id);
        }
        return $q->orderByRaw('COALESCE(full_name, email)')->get()->toArray();
    }

    // ── SMS provider status ───────────────────────────────────────────
    protected function rpc_get_sms_provider_status(array $p): array
    {
        $provider = $p['_provider'] ?? 'greenweb';

        $active = DB::table('sms_provider_secrets')
            ->where('provider', $provider)
            ->where('status', 'active')
            ->orderByDesc('activated_at')
            ->first();

        $stagedCount = (int) DB::table('sms_provider_secrets')
            ->where('provider', $provider)
            ->where('status', 'staged')
            ->count();

        $settings = Schema::hasTable('sms_settings')
            ? DB::table('sms_settings')->first()
            : null;

        $expiresAt = $active->expires_at ?? null;
        $daysToExpiry = null;
        $expired = false;
        if ($expiresAt) {
            $diff = (strtotime($expiresAt) - time()) / 86400;
            $daysToExpiry = (int) floor($diff);
            $expired = $diff < 0;
        }

        return [
            'configured'    => (bool) $active,
            'enabled'       => (bool) ($settings->enabled ?? false),
            'sender_id'     => $settings->sender_id ?? null,
            'expires_at'    => $expiresAt,
            'days_to_expiry'=> $daysToExpiry,
            'expired'       => $expired,
            'activated_at'  => $active->activated_at ?? null,
            'last_updated'  => $active->updated_at ?? null,
            'last_updater'  => $active->updated_by ?? null,
            'staged_count'  => $stagedCount,
            'last_test'     => null,
        ];
    }

    // ── Ledger integrity ──────────────────────────────────────────────
    protected function rpc_ledger_unbalanced_refs(): array
    {
        return DB::table('ledger_entries')
            ->whereNotNull('reference_type')
            ->whereNotNull('reference_id')
            ->groupBy('reference_type', 'reference_id')
            ->havingRaw('ABS(SUM(debit) - SUM(credit)) > 0.005')
            ->get([
                'reference_type',
                'reference_id',
                DB::raw('SUM(debit) as total_debit'),
                DB::raw('SUM(credit) as total_credit'),
                DB::raw('SUM(debit) - SUM(credit) as diff'),
            ])->toArray();
    }

    protected function rpc_ledger_orphan_refs(): array
    {
        $map = [
            'savings'      => 'savings_transactions',
            'loan'         => 'loans',
            'loan_payment' => 'loan_payments',
            'irrigation'   => 'irrigation_invoices',
            'expense'      => 'expenses',
            'journal'      => 'journal_entries',
        ];

        $rows = DB::table('ledger_entries')
            ->whereNotNull('reference_type')
            ->whereNotNull('reference_id')
            ->groupBy('reference_type', 'reference_id')
            ->get([
                'reference_type',
                'reference_id',
                DB::raw('COUNT(*) as entry_count'),
            ]);

        $orphans = [];
        foreach ($rows as $r) {
            $tbl = $map[$r->reference_type] ?? null;
            if (! $tbl || ! Schema::hasTable($tbl)) {
                continue; // unknown ref type — not treated as orphan
            }
            $exists = DB::table($tbl)->where('id', $r->reference_id)->exists();
            if (! $exists) {
                $orphans[] = [
                    'reference_type' => $r->reference_type,
                    'reference_id'   => $r->reference_id,
                    'entry_count'    => (int) $r->entry_count,
                ];
            }
        }
        return $orphans;
    }

    protected function rpc_ledger_integrity_summary(): array
    {
        $agg = DB::table('ledger_entries')
            ->selectRaw('COUNT(*) as total_entries, COALESCE(SUM(debit),0) as total_debit, COALESCE(SUM(credit),0) as total_credit, SUM(CASE WHEN account_id IS NULL THEN 1 ELSE 0 END) as missing_accounts')
            ->first();

        return [
            'total_entries'    => (int) ($agg->total_entries ?? 0),
            'total_debit'      => (float) ($agg->total_debit ?? 0),
            'total_credit'     => (float) ($agg->total_credit ?? 0),
            'balanced'         => abs(((float) ($agg->total_debit ?? 0)) - ((float) ($agg->total_credit ?? 0))) < 0.005,
            'missing_accounts' => (int) ($agg->missing_accounts ?? 0),
        ];
    }

    // ── Developer access audit ────────────────────────────────────────
    protected function rpc_log_developer_access(array $p, Request $request): ?string
    {
        try {
            if (! Schema::hasTable('developer_update_logs')) {
                return null;
            }
            $user = $request->user();
            $meta = isset($p['_meta']) ? json_encode($p['_meta']) : null;
            DB::table('developer_update_logs')->insert([
                'id'         => (string) Str::uuid(),
                'user_id'    => $user->id ?? '00000000-0000-0000-0000-000000000000',
                'action'     => $p['_action'] ?? 'unknown',
                'repo_url'   => 'app://developer-access',
                'note'       => trim(($p['_action'] ?? '') . ($meta ? " {$meta}" : '')),
                'status'     => ! empty($p['_blocked']) ? 'blocked' : 'ok',
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Audit failures must never break the caller.
        }
        return null;
    }

    // ── RPC fallback audit (traces the permanent invoice fix in production) ──
    protected function rpc_log_rpc_fallback(array $p, Request $request): ?string
    {
        try {
            if (! Schema::hasTable('audit_logs')) {
                return null;
            }
            $user = $request->user();
            $requestId = $p['request_id'] ?? (string) Str::uuid();
            $office = $user->office_id ?? $user->office ?? null;
            $detail = [
                'rpc'        => $p['rpc'] ?? 'unknown',
                'land_id'    => $p['land_id'] ?? null,
                'office'     => $office,
                'request_id' => $requestId,
                'error'      => $p['error'] ?? null,
            ];

            $row = ['action' => 'rpc.fallback_used', 'created_at' => now()];
            if (Schema::hasColumn('audit_logs', 'id'))        $row['id'] = (string) Str::uuid();
            if (Schema::hasColumn('audit_logs', 'user_id'))   $row['user_id'] = $user->id ?? null;
            if (Schema::hasColumn('audit_logs', 'entity'))    $row['entity'] = 'rpc';
            if (Schema::hasColumn('audit_logs', 'entity_id')) $row['entity_id'] = $detail['land_id'];
            if (Schema::hasColumn('audit_logs', 'office_id')) $row['office_id'] = $office;
            if (Schema::hasColumn('audit_logs', 'meta'))      $row['meta'] = json_encode($detail);

            DB::table('audit_logs')->insert($row);
            return $requestId;
        } catch (\Throwable $e) {
            // Audit failures must never break the caller.
        }
        return null;
    }

    // ── Permanent cascade delete of a payment / irrigation receipt ──────
    // Removes the payment and every related row (journal entries + lines,
    // irrigation invoice links, payment allocations), restores affected
    // irrigation invoices' paid/due/status, and writes an audit entry.
    protected function rpc_delete_payment_cascade(array $p, Request $request): array
    {
        $paymentId = $p['_payment_id'] ?? $p['payment_id'] ?? null;
        if (! $paymentId) {
            throw new \RuntimeException('Payment id is required.');
        }

        $payment = DB::table('payments')->where('id', $paymentId)->first();
        if (! $payment) {
            throw new \RuntimeException('Payment not found');
        }

        $receiptNo = $payment->receipt_no ?? null;
        $user = $request->user();

        $affected = DB::transaction(function () use ($paymentId, $receiptNo) {
            $counts = [
                'payments' => 0,
                'irrigation_invoice_payments' => 0,
                'payment_allocations' => 0,
                'journal_entries' => 0,
                'journal_entry_lines' => 0,
            ];

            // 1) Restore irrigation invoices for each invoice payment we remove.
            if (Schema::hasTable('irrigation_invoice_payments')) {
                $iips = DB::table('irrigation_invoice_payments')
                    ->where('payment_id', $paymentId)->get();
                foreach ($iips as $iip) {
                    $inv = DB::table('irrigation_invoices')->where('id', $iip->invoice_id)
                        ->lockForUpdate()->first();
                    if ($inv) {
                        $paid = max(0, (float) ($inv->paid_amount ?? 0) - (float) ($iip->amount ?? 0));
                        $base = (float) ($inv->amount ?? $inv->payable_amount ?? 0);
                        $due = max(0, $base - $paid);
                        $update = [
                            'paid_amount' => $paid,
                            'due_amount' => $due,
                            'updated_at' => now(),
                        ];
                        $status = $due <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid');
                        if (Schema::hasColumn('irrigation_invoices', 'status')) {
                            $update['status'] = $status;
                        }
                        if (Schema::hasColumn('irrigation_invoices', 'invoice_status')) {
                            $update['invoice_status'] = $status;
                        }
                        DB::table('irrigation_invoices')->where('id', $inv->id)->update($update);
                    }
                }
                $counts['irrigation_invoice_payments'] =
                    DB::table('irrigation_invoice_payments')->where('payment_id', $paymentId)->delete();
            }

            // 2) Delete accounting journals posted for this receipt.
            if ($receiptNo !== null && trim((string) $receiptNo) !== '' && Schema::hasTable('journal_entries')) {
                $jeIds = DB::table('journal_entries')->where('reference', $receiptNo)->pluck('id')->all();
                if (! empty($jeIds)) {
                    if (Schema::hasTable('journal_entry_lines')) {
                        $counts['journal_entry_lines'] =
                            DB::table('journal_entry_lines')->whereIn('journal_id', $jeIds)->delete();
                    }
                    $counts['journal_entries'] =
                        DB::table('journal_entries')->whereIn('id', $jeIds)->delete();
                }
            }

            // 3) Payment allocations.
            if (Schema::hasTable('payment_allocations')) {
                $counts['payment_allocations'] =
                    DB::table('payment_allocations')->where('payment_id', $paymentId)->delete();
            }

            // 4) The payment itself.
            $counts['payments'] = DB::table('payments')->where('id', $paymentId)->delete();

            return $counts;
        });

        // 5) Audit log (best-effort — never breaks the delete).
        try {
            if (Schema::hasTable('system_audit_logs')) {
                $row = [
                    'module' => 'payments',
                    'action_type' => 'delete',
                    'reference_id' => (string) $paymentId,
                    'created_at' => now(),
                ];
                if (Schema::hasColumn('system_audit_logs', 'id')) $row['id'] = (string) Str::uuid();
                if (Schema::hasColumn('system_audit_logs', 'user_id')) $row['user_id'] = $user->id ?? null;
                if (Schema::hasColumn('system_audit_logs', 'office_id')) $row['office_id'] = $payment->office_id ?? ($user->office_id ?? null);
                $oldData = [
                    'receipt_no' => $receiptNo,
                    'farmer_id' => $payment->farmer_id ?? null,
                    'amount' => $payment->amount ?? null,
                ];
                $newData = ['permanent_delete' => true, 'affected' => $affected];
                if (Schema::hasColumn('system_audit_logs', 'old_data')) $row['old_data'] = json_encode($oldData);
                if (Schema::hasColumn('system_audit_logs', 'new_data')) $row['new_data'] = json_encode($newData);
                DB::table('system_audit_logs')->insert($row);
            }
        } catch (\Throwable $e) {
            // ignore audit failures
        }

        return ['ok' => true, 'affected' => $affected];
    }

    // ── Receipt serial number generation (MySQL-backed) ─────────────────
    // Atomically issues the next numeric receipt number, honouring the admin
    // configured `receipt_serial_start` and never colliding with an existing
    // used number. This is the SINGLE source of truth on the VPS backend so
    // the serial start actually drives the generated receipt number.
    protected function rpc_next_serial_receipt_no(array $p): string
    {
        return DB::transaction(function () {
            // Highest actually-used numeric receipt number across payments/receipts.
            $maxUsed = 0;
            foreach (['payments', 'receipts'] as $tbl) {
                if (Schema::hasTable($tbl) && Schema::hasColumn($tbl, 'receipt_no')) {
                    $m = (int) (DB::table($tbl)
                        ->whereRaw("receipt_no REGEXP '^[0-9]+$'")
                        ->max(DB::raw('CAST(receipt_no AS UNSIGNED)')) ?? 0);
                    if ($m > $maxUsed) {
                        $maxUsed = $m;
                    }
                }
            }

            // Admin-configured serial start (treated as "last used" → next = start + 1).
            $start = 0;
            if (Schema::hasTable('receipt_settings') && Schema::hasColumn('receipt_settings', 'receipt_serial_start')) {
                $start = (int) (DB::table('receipt_settings')->where('id', 1)->value('receipt_serial_start') ?? 0);
            }

            $counter = null;
            if (Schema::hasTable('receipt_counters')) {
                $counter = DB::table('receipt_counters')
                    ->where('kind', 'SERIAL')->where('year', 0)
                    ->lockForUpdate()->first();
            }
            $lastNo = $counter ? (int) $counter->last_no : 0;

            // Baseline = highest of live counter, real max used, and (start - 1)
            // so the very next receipt is exactly max(start, maxUsed + 1).
            $baseline = max($lastNo, $maxUsed, max(0, $start - 1));
            $next = $baseline + 1;

            if (Schema::hasTable('receipt_counters')) {
                if ($counter) {
                    DB::table('receipt_counters')
                        ->where('kind', 'SERIAL')->where('year', 0)
                        ->update(['last_no' => $next, 'updated_at' => now()]);
                } else {
                    DB::table('receipt_counters')->insert([
                        'kind' => 'SERIAL', 'year' => 0, 'last_no' => $next, 'updated_at' => now(),
                    ]);
                }
            }

            return (string) $next;
        });
    }

    // Alias used by the unified paid-receipt flow (irrigation/savings/loan/combined).
    protected function rpc_next_unified_receipt_no(array $p): string
    {
        return $this->rpc_next_serial_receipt_no($p);
    }
}


