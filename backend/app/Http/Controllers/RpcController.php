<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
        return DB::table('farmers')
            ->when($excludeId, fn ($q) => $q->where('id', '<>', $excludeId))
            ->where(function ($q) use ($candidate) {
                $q->where('farmer_code', $candidate)
                  ->orWhere('member_no', $candidate)
                  ->orWhere('account_number', $candidate)
                  ->orWhere('voter_number', $candidate);
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
        return DB::table('irrigation_invoices')
            ->where('farmer_id', $p['_farmer_id'] ?? null)
            ->whereNull('deleted_at')
            ->where('invoice_status', '<>', 'cancelled')
            ->count();
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
