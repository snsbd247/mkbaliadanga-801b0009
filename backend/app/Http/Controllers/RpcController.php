<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
}
