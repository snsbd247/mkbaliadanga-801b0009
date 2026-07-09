<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Makes the accounting ledger complete and consistent:
 *   1. Ensures the stream-level expense accounts (5100 Irrigation, 5200 Society)
 *      exist so every expense can be posted.
 *   2. Posts a balanced Dr Expense / Cr Cash journal for every existing expense
 *      that is not yet in the ledger (idempotent by reference_type/reference_id).
 *   3. Re-aligns historical irrigation payment journals to the exact collected
 *      amount (sum of irrigation_invoice_payments) so the ledger matches the
 *      Financial Summary figure exactly.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('accounts') || ! Schema::hasTable('ledger_entries')) {
            return;
        }

        // 1. Ensure expense accounts exist (global, office_id null).
        $ensureAccount = function (string $code, string $name, string $nameBn) {
            $exists = DB::table('accounts')->where('code', $code)->whereNull('office_id')->exists();
            if (! $exists) {
                DB::table('accounts')->insert([
                    'id' => (string) Str::uuid(),
                    'office_id' => null,
                    'code' => $code,
                    'name' => $name,
                    'name_bn' => $nameBn,
                    'type' => 'expense',
                    'parent_id' => null,
                    'is_system' => true,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        };
        $ensureAccount('5100', 'Irrigation Expense', 'সেচ খরচ');
        $ensureAccount('5200', 'Society Expense', 'সমিতি খরচ');

        $acc = DB::table('accounts')->whereNull('office_id')
            ->whereIn('code', ['1010', '5100', '5200', '5090'])->get(['id', 'code'])->keyBy('code');
        $cashId = $acc['1010']->id ?? null;
        $irrExp = $acc['5100']->id ?? ($acc['5090']->id ?? null);
        $socExp = $acc['5200']->id ?? ($acc['5090']->id ?? null);

        // 2. Backfill expense journals.
        if ($cashId && $irrExp && $socExp && Schema::hasTable('expenses')) {
            DB::table('expenses')
                ->when(Schema::hasColumn('expenses', 'deleted_at'), fn ($q) => $q->whereNull('deleted_at'))
                ->orderBy('created_at')
                ->chunk(100, function ($expenses) use ($cashId, $irrExp, $socExp) {
                    foreach ($expenses as $e) {
                        $amount = round((float) ($e->amount ?? 0), 2);
                        if ($amount <= 0) continue;
                        $already = DB::table('ledger_entries')
                            ->where('reference_type', 'expense')->where('reference_id', $e->id)->exists();
                        if ($already) continue;

                        $expAcc = (($e->stream ?? 'irrigation') === 'irrigation') ? $irrExp : $socExp;
                        $date = substr((string) ($e->expense_date ?? now()->format('Y-m-d')), 0, 10);
                        $desc = 'খরচ — ' . (string) ($e->head ?? '');
                        $now = now();
                        DB::table('ledger_entries')->insert([
                            [
                                'id' => (string) Str::uuid(), 'entry_date' => $date, 'account_id' => $expAcc,
                                'debit' => $amount, 'credit' => 0, 'reference_type' => 'expense',
                                'reference_id' => $e->id, 'description' => $desc,
                                'office_id' => $e->office_id ?? null, 'created_by' => $e->created_by ?? null,
                                'created_at' => $now,
                            ],
                            [
                                'id' => (string) Str::uuid(), 'entry_date' => $date, 'account_id' => $cashId,
                                'debit' => 0, 'credit' => $amount, 'reference_type' => 'expense',
                                'reference_id' => $e->id, 'description' => $desc . ' — নগদ পরিশোধ',
                                'office_id' => $e->office_id ?? null, 'created_by' => $e->created_by ?? null,
                                'created_at' => $now,
                            ],
                        ]);
                    }
                });
        }

        // 3. Re-align irrigation payment journals to exact collected amount.
        if (Schema::hasTable('irrigation_invoice_payments')) {
            $collected = DB::table('irrigation_invoice_payments')
                ->select('payment_id', DB::raw('SUM(collected_amount) as total'))
                ->groupBy('payment_id')->get()->keyBy('payment_id');

            DB::table('ledger_entries')->where('reference_type', 'irrigation_payment')
                ->select('reference_id')->distinct()->orderBy('reference_id')
                ->chunk(200, function ($rows) use ($collected) {
                    foreach ($rows as $r) {
                        $pid = $r->reference_id;
                        $amt = isset($collected[$pid]) ? round((float) $collected[$pid]->total, 2) : null;
                        if ($amt === null || $amt <= 0) continue;
                        DB::table('ledger_entries')->where('reference_type', 'irrigation_payment')
                            ->where('reference_id', $pid)->where('debit', '>', 0)->update(['debit' => $amt]);
                        DB::table('ledger_entries')->where('reference_type', 'irrigation_payment')
                            ->where('reference_id', $pid)->where('credit', '>', 0)->update(['credit' => $amt]);
                    }
                });
        }
    }

    public function down(): void
    {
        // Non-reversible data backfill; expense journals can be removed manually
        // via reference_type = 'expense' if ever required.
    }
};
