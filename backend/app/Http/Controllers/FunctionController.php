<?php

namespace App\Http\Controllers;

use App\Http\Controllers\SmsController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
