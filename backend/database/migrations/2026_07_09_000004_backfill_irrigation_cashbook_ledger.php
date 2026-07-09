<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')
            || ! Schema::hasColumn('payments', 'kind')
            || ! Schema::hasColumn('payments', 'status')) {
            return;
        }

        $accounts = Schema::hasTable('accounts')
            ? DB::table('accounts')->whereIn('code', ['1010', 'IRR-INCOME', '4010'])->get(['id', 'code'])->keyBy('code')
            : collect();
        $cashId = $accounts['1010']->id ?? null;
        $incomeId = $accounts['IRR-INCOME']->id ?? $accounts['4010']->id ?? null;

        DB::table('payments')
            ->where('kind', 'irrigation')
            ->where('status', 'approved')
            ->whereNotNull('receipt_no')
            ->orderBy('created_at')
            ->chunk(100, function ($payments) use ($cashId, $incomeId) {
                foreach ($payments as $payment) {
                    $amount = round((float) $payment->amount, 2);
                    if ($amount <= 0) continue;

                    $paymentDate = substr((string) ($payment->occurred_at ?? $payment->created_at ?? now()->format('Y-m-d')), 0, 10);
                    $now = now();

                    if (Schema::hasTable('receipts')
                        && ! DB::table('receipts')->where('kind', 'irrigation')->where('receipt_no', $payment->receipt_no)->exists()) {
                        $receipt = [
                            'id' => (string) Str::uuid(),
                            'receipt_no' => $payment->receipt_no,
                            'kind' => 'irrigation',
                            'farmer_id' => $payment->farmer_id,
                            'reference_id' => $payment->id,
                            'amount' => $amount,
                            'method' => $payment->method ?? 'cash',
                            'note' => $payment->note ?? null,
                            'receipt_date' => $paymentDate,
                            'office_id' => $payment->office_id,
                            'collected_by' => $payment->collected_by ?? $payment->created_by ?? null,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                        foreach (array_keys($receipt) as $col) {
                            if (! Schema::hasColumn('receipts', $col)) unset($receipt[$col]);
                        }
                        DB::table('receipts')->insert($receipt);
                    }

                    if (Schema::hasTable('ledger_entries') && $cashId && $incomeId
                        && ! DB::table('ledger_entries')->where('reference_type', 'irrigation_payment')->where('reference_id', $payment->id)->exists()) {
                        DB::table('ledger_entries')->insert([
                            [
                                'id' => (string) Str::uuid(),
                                'entry_date' => $paymentDate,
                                'account_id' => $cashId,
                                'debit' => $amount,
                                'credit' => 0,
                                'reference_type' => 'irrigation_payment',
                                'reference_id' => $payment->id,
                                'description' => "সেচ পেমেন্ট {$payment->receipt_no} — Cash received",
                                'office_id' => $payment->office_id,
                                'created_by' => $payment->collected_by ?? $payment->created_by ?? null,
                                'created_at' => $now,
                            ],
                            [
                                'id' => (string) Str::uuid(),
                                'entry_date' => $paymentDate,
                                'account_id' => $incomeId,
                                'debit' => 0,
                                'credit' => $amount,
                                'reference_type' => 'irrigation_payment',
                                'reference_id' => $payment->id,
                                'description' => "সেচ পেমেন্ট {$payment->receipt_no} — Irrigation income",
                                'office_id' => $payment->office_id,
                                'created_by' => $payment->collected_by ?? $payment->created_by ?? null,
                                'created_at' => $now,
                            ],
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Data backfill only; never delete real cashbook/ledger rows on rollback.
    }
};