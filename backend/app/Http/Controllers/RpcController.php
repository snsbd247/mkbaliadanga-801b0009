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

    /**
     * Permanently delete a farmer from the database, but ONLY when the farmer
     * has no transactional records. Returns a status payload the frontend can
     * use to show a clear message.
     */
    protected function rpc_farmer_permanent_delete(array $p, Request $request): array
    {
        $farmerId = $p['_farmer_id'] ?? $p['farmer_id'] ?? null;
        if (! $farmerId) {
            return ['ok' => false, 'reason' => 'missing_id', 'message' => 'ফার্মার আইডি পাওয়া যায়নি।'];
        }

        // Tables that represent real activity/transactions for a farmer.
        $txnTables = [
            'irrigation_invoices', 'irrigation_charges', 'irrigation_invoice_payments',
            'savings_transactions', 'loans', 'loan_payments', 'payments',
            'shares', 'office_incomes', 'lands', 'land_relations',
            'land_transfers', 'land_history', 'receipts',
        ];

        $blocking = [];
        foreach ($txnTables as $tbl) {
            if (! Schema::hasTable($tbl) || ! Schema::hasColumn($tbl, 'farmer_id')) {
                continue;
            }
            $q = DB::table($tbl)->where('farmer_id', $farmerId);
            if (Schema::hasColumn($tbl, 'deleted_at')) {
                $q->whereNull('deleted_at');
            }
            $count = $q->count();
            if ($count > 0) {
                $blocking[$tbl] = $count;
            }
        }

        if (! empty($blocking)) {
            return [
                'ok' => false,
                'reason' => 'has_transactions',
                'blocking' => $blocking,
                'message' => 'এই ফার্মারের লেনদেন/রেকর্ড থাকায় পারমানেন্ট ডিলিট করা যাবে না।',
            ];
        }

        DB::table('farmers')->where('id', $farmerId)->delete();

        return ['ok' => true, 'message' => 'ফার্মার পারমানেন্টভাবে ডিলিট করা হয়েছে।'];
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
}
