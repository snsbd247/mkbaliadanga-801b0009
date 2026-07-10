<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Backfills the accounting ledger with each bank account's opening balance so the
 * Bank account (1020) shows a real balance in the Chart of Accounts / Trial
 * Balance. Posts a balanced Dr Bank / Cr Opening Balance Equity entry per bank
 * account. Idempotent on (reference_type='bank_opening', reference_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ledger_entries') || ! Schema::hasTable('bank_accounts') || ! Schema::hasTable('accounts')) {
            return;
        }

        $bankId = DB::table('accounts')->where('code', '1020')->whereNull('office_id')->value('id');
        $equityId = DB::table('accounts')->whereIn('code', ['3000', '3020'])->whereNull('office_id')->orderByRaw("FIELD(code, '3000','3020')")->value('id');
        if (! $bankId || ! $equityId) {
            return;
        }

        $now = now();
        foreach (DB::table('bank_accounts')->get() as $acc) {
            $opening = round((float) ($acc->opening_balance ?? 0), 2);
            if ($opening == 0.0) {
                continue;
            }
            $exists = DB::table('ledger_entries')
                ->where('reference_type', 'bank_opening')
                ->where('reference_id', $acc->id)
                ->exists();
            if ($exists) {
                continue;
            }

            $debit = $opening >= 0 ? $opening : 0;
            $credit = $opening >= 0 ? 0 : abs($opening);
            $date = substr((string) ($acc->created_at ?? $now->format('Y-m-d')), 0, 10);
            $desc = 'ব্যাংক প্রারম্ভিক জের — ' . ($acc->bank_name ?? '') . ' ' . ($acc->account_no ?? '');

            DB::table('ledger_entries')->insert([
                [
                    'id' => (string) Str::uuid(),
                    'entry_date' => $date,
                    'account_id' => $bankId,
                    'debit' => $debit,
                    'credit' => $credit,
                    'reference_type' => 'bank_opening',
                    'reference_id' => $acc->id,
                    'description' => $desc,
                    'office_id' => $acc->office_id ?? null,
                    'created_by' => null,
                    'created_at' => $now,
                ],
                [
                    'id' => (string) Str::uuid(),
                    'entry_date' => $date,
                    'account_id' => $equityId,
                    'debit' => $credit,
                    'credit' => $debit,
                    'reference_type' => 'bank_opening',
                    'reference_id' => $acc->id,
                    'description' => $desc . ' — মূলধন',
                    'office_id' => $acc->office_id ?? null,
                    'created_by' => null,
                    'created_at' => $now,
                ],
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ledger_entries')) {
            DB::table('ledger_entries')->where('reference_type', 'bank_opening')->delete();
        }
    }
};
