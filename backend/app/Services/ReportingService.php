<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ReportingService
{
    public function trialBalance(string $officeId, string $from, string $to): array {
        return DB::table('ledger_entries as l')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.office_id', $officeId)
            ->whereBetween('l.entry_date', [$from, $to])
            ->groupBy('a.id', 'a.code', 'a.name', 'a.type')
            ->orderBy('a.code')
            ->select('a.id','a.code','a.name','a.type',
                DB::raw('SUM(l.debit) as debit'),
                DB::raw('SUM(l.credit) as credit'),
                DB::raw('SUM(l.debit) - SUM(l.credit) as balance'))
            ->get()->toArray();
    }

    public function profitAndLoss(string $officeId, string $from, string $to): array {
        $rows = $this->trialBalance($officeId, $from, $to);
        $income  = collect($rows)->where('type', 'income')->sum(fn($r) => -$r->balance);
        $expense = collect($rows)->where('type', 'expense')->sum('balance');
        return ['income' => round($income, 2), 'expense' => round($expense, 2), 'profit' => round($income - $expense, 2), 'rows' => $rows];
    }

    public function balanceSheet(string $officeId, string $asOf): array {
        $rows = $this->trialBalance($officeId, '1970-01-01', $asOf);
        $assets      = collect($rows)->where('type', 'asset')->sum('balance');
        $liabilities = collect($rows)->where('type', 'liability')->sum(fn($r) => -$r->balance);
        $equity      = collect($rows)->where('type', 'equity')->sum(fn($r) => -$r->balance);
        return ['assets' => round($assets, 2), 'liabilities' => round($liabilities, 2), 'equity' => round($equity, 2), 'rows' => $rows];
    }

    public function cashbook(string $officeId, string $from, string $to): array {
        return DB::table('ledger_entries as l')
            ->join('accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.office_id', $officeId)
            ->whereIn('a.code', ['1000', '1010'])
            ->whereBetween('l.entry_date', [$from, $to])
            ->orderBy('l.entry_date')
            ->select('l.entry_date','a.code','a.name','l.debit','l.credit','l.memo','l.reference_type','l.reference_id')
            ->get()->toArray();
    }
}
