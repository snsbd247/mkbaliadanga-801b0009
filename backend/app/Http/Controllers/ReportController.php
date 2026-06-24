<?php

namespace App\Http\Controllers;

use App\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /** Per-account debit/credit totals + net balance. */
    public function trialBalance(Request $request): JsonResponse
    {
        $rows = $this->accountTotals($request);

        $totalDebit = 0.0;
        $totalCredit = 0.0;
        $lines = $rows->map(function ($r) use (&$totalDebit, &$totalCredit) {
            $debit = (float) $r->debit;
            $credit = (float) $r->credit;
            $balance = round($debit - $credit, 2);
            $totalDebit += $debit;
            $totalCredit += $credit;
            return [
                'account_id' => $r->id,
                'code' => $r->code,
                'name' => $r->name,
                'type' => $r->type,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => $balance,
            ];
        })->values();

        return response()->json([
            'rows' => $lines,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
        ]);
    }

    /** Income vs expense over a date range. */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $rows = $this->accountTotals($request);

        $income = $rows->where('type', 'income')->map(fn ($r) => [
            'account_id' => $r->id, 'code' => $r->code, 'name' => $r->name,
            'amount' => round((float) $r->credit - (float) $r->debit, 2),
        ])->values();

        $expense = $rows->where('type', 'expense')->map(fn ($r) => [
            'account_id' => $r->id, 'code' => $r->code, 'name' => $r->name,
            'amount' => round((float) $r->debit - (float) $r->credit, 2),
        ])->values();

        $totalIncome = round($income->sum('amount'), 2);
        $totalExpense = round($expense->sum('amount'), 2);

        return response()->json([
            'income' => $income,
            'expense' => $expense,
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'net_profit' => round($totalIncome - $totalExpense, 2),
        ]);
    }

    /** Asset / liability / equity balances as of a date. */
    public function balanceSheet(Request $request): JsonResponse
    {
        $rows = $this->accountTotals($request, dateColumn: 'as_of');

        $section = fn (string $type, bool $debitNormal) => $rows->where('type', $type)->map(fn ($r) => [
            'account_id' => $r->id, 'code' => $r->code, 'name' => $r->name,
            'amount' => round($debitNormal
                ? (float) $r->debit - (float) $r->credit
                : (float) $r->credit - (float) $r->debit, 2),
        ])->values();

        $assets = $section('asset', true);
        $liabilities = $section('liability', false);
        $equity = $section('equity', false);

        return response()->json([
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'total_assets' => round($assets->sum('amount'), 2),
            'total_liabilities' => round($liabilities->sum('amount'), 2),
            'total_equity' => round($equity->sum('amount'), 2),
        ]);
    }

    /** Dated journal lines for cash-type accounts with a running balance. */
    public function cashbook(Request $request): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $entries = DB::table('journal_lines as jl')
            ->join('journal_entries as je', 'je.id', '=', 'jl.entry_id')
            ->join('accounts as a', 'a.id', '=', 'jl.account_id')
            ->where('a.type', 'asset')
            ->where(function ($w) {
                $w->where('a.name', 'like', '%cash%')
                    ->orWhere('a.name_bn', 'like', '%নগদ%')
                    ->orWhere('a.code', 'like', '%cash%');
            })
            ->when($scopeOffice, fn ($q) => $q->where('je.office_id', $scopeOffice))
            ->when($request->query('from'), fn ($q, $f) => $q->whereDate('je.entry_date', '>=', $f))
            ->when($request->query('to'), fn ($q, $t) => $q->whereDate('je.entry_date', '<=', $t))
            ->orderBy('je.entry_date')
            ->orderBy('je.created_at')
            ->get(['je.entry_date', 'je.reference', 'je.memo', 'jl.debit', 'jl.credit', 'a.name as account']);

        $running = 0.0;
        $rows = $entries->map(function ($e) use (&$running) {
            $running += (float) $e->debit - (float) $e->credit;
            return [
                'date' => $e->entry_date,
                'reference' => $e->reference,
                'memo' => $e->memo,
                'account' => $e->account,
                'debit' => round((float) $e->debit, 2),
                'credit' => round((float) $e->credit, 2),
                'balance' => round($running, 2),
            ];
        });

        return response()->json([
            'rows' => $rows,
            'closing_balance' => round($running, 2),
        ]);
    }

    /** Sum debit/credit per account, optionally bounded by a date range. */
    private function accountTotals(Request $request, string $dateColumn = 'to')
    {
        $scopeOffice = $request->attributes->get('scope_office_id');
        $from = $request->query('from');
        $to = $request->query($dateColumn) ?? $request->query('to');

        return Account::query()
            ->when($scopeOffice, fn ($q) => $q->where(function ($w) use ($scopeOffice) {
                $w->where('accounts.office_id', $scopeOffice)->orWhereNull('accounts.office_id');
            }))
            ->leftJoin('journal_lines as jl', 'jl.account_id', '=', 'accounts.id')
            ->leftJoin('journal_entries as je', 'je.id', '=', 'jl.entry_id')
            ->when($from, fn ($q) => $q->whereDate('je.entry_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('je.entry_date', '<=', $to))
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.type')
            ->get([
                'accounts.id', 'accounts.code', 'accounts.name', 'accounts.type',
                DB::raw('COALESCE(SUM(jl.debit),0) as debit'),
                DB::raw('COALESCE(SUM(jl.credit),0) as credit'),
            ]);
    }
}
