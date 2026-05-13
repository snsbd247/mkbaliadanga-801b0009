<?php

namespace App\Services;

use App\Models\Account;
use App\Models\SavingsAccount;
use App\Models\SavingsTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SavingsService
{
    public function __construct(private AccountingService $accounting) {}

    public function openAccount(string $officeId, string $farmerId, ?string $code = null): SavingsAccount {
        return SavingsAccount::create([
            'office_id' => $officeId,
            'farmer_id' => $farmerId,
            'code'      => $code ?: 'SV-'.strtoupper(Str::random(7)),
            'opened_on' => now()->toDateString(),
        ]);
    }

    public function deposit(SavingsAccount $a, float $amount, string $txDate, ?string $userId, ?string $memo = null): SavingsTransaction {
        return DB::transaction(function () use ($a, $amount, $txDate, $userId, $memo) {
            $tx = SavingsTransaction::create([
                'savings_account_id' => $a->id, 'office_id' => $a->office_id,
                'tx_date' => $txDate, 'kind' => 'deposit', 'amount' => $amount,
                'created_by' => $userId, 'memo' => $memo,
                'receipt_no' => 'SVD-'.now()->format('ymd').'-'.strtoupper(Str::random(5)),
            ]);
            $a->increment('balance', $amount);
            $cash = Account::where('office_id', $a->office_id)->where('code', '1000')->first();
            $sav  = Account::where('office_id', $a->office_id)->where('code', '2000')->first();
            if ($cash && $sav) {
                $this->accounting->postJournal($a->office_id, $txDate, [
                    ['account_id' => $cash->id, 'debit' => $amount, 'credit' => 0],
                    ['account_id' => $sav->id,  'debit' => 0, 'credit' => $amount],
                ], ['source_type' => 'savings_tx', 'source_id' => $tx->id, 'reference' => $tx->receipt_no, 'memo' => 'Savings deposit', 'created_by' => $userId]);
            }
            return $tx;
        });
    }

    public function withdraw(SavingsAccount $a, float $amount, string $txDate, ?string $userId, ?string $memo = null): SavingsTransaction {
        abort_if((float)$a->balance < $amount, 422, 'Insufficient savings balance.');
        return DB::transaction(function () use ($a, $amount, $txDate, $userId, $memo) {
            $tx = SavingsTransaction::create([
                'savings_account_id' => $a->id, 'office_id' => $a->office_id,
                'tx_date' => $txDate, 'kind' => 'withdraw', 'amount' => $amount,
                'created_by' => $userId, 'memo' => $memo,
                'receipt_no' => 'SVW-'.now()->format('ymd').'-'.strtoupper(Str::random(5)),
            ]);
            $a->decrement('balance', $amount);
            $cash = Account::where('office_id', $a->office_id)->where('code', '1000')->first();
            $sav  = Account::where('office_id', $a->office_id)->where('code', '2000')->first();
            if ($cash && $sav) {
                $this->accounting->postJournal($a->office_id, $txDate, [
                    ['account_id' => $sav->id,  'debit' => $amount, 'credit' => 0],
                    ['account_id' => $cash->id, 'debit' => 0, 'credit' => $amount],
                ], ['source_type' => 'savings_tx', 'source_id' => $tx->id, 'reference' => $tx->receipt_no, 'memo' => 'Savings withdrawal', 'created_by' => $userId]);
            }
            return $tx;
        });
    }
}
