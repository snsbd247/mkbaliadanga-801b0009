<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Loan;
use App\Models\LoanInstallment;
use App\Models\LoanPlan;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LoanService
{
    public function __construct(private AccountingService $accounting) {}

    public function create(string $officeId, array $data): Loan {
        return DB::transaction(function () use ($officeId, $data) {
            $plan = isset($data['plan_id']) ? LoanPlan::find($data['plan_id']) : null;
            $loan = Loan::create([
                'office_id'    => $officeId,
                'farmer_id'    => $data['farmer_id'],
                'plan_id'      => $plan?->id,
                'code'         => $data['code']         ?? 'LN-'.strtoupper(Str::random(6)),
                'principal'    => $data['principal'],
                'interest_pct' => $data['interest_pct'] ?? $plan?->interest_pct ?? 0,
                'term_months'  => $data['term_months']  ?? $plan?->default_term_months ?? 12,
                'first_due_on' => $data['first_due_on'] ?? null,
                'status'       => 'pending',
                'outstanding'  => $data['principal'],
            ]);
            $loan->update(['schedule' => $this->buildSchedule($loan)]);
            return $loan;
        });
    }

    public function approve(Loan $loan, string $approverId, string $disbursedOn): Loan {
        return DB::transaction(function () use ($loan, $approverId, $disbursedOn) {
            $loan->update([
                'status'       => 'active',
                'approved_by'  => $approverId,
                'approved_at'  => now(),
                'disbursed_on' => $disbursedOn,
                'first_due_on' => $loan->first_due_on ?? Carbon::parse($disbursedOn)->addMonth()->toDateString(),
            ]);
            $this->generateInstallments($loan);
            $this->postDisbursement($loan, $disbursedOn);
            return $loan->refresh();
        });
    }

    public function buildSchedule(Loan $loan): array {
        $rows = [];
        $monthly = round(((float)$loan->principal) / max(1, $loan->term_months), 2);
        $interestPerMonth = round(((float)$loan->principal * ((float)$loan->interest_pct/100)) / max(1, $loan->term_months), 2);
        $start = $loan->first_due_on ? Carbon::parse($loan->first_due_on) : Carbon::now()->addMonth();
        for ($i = 1; $i <= $loan->term_months; $i++) {
            $rows[] = [
                'seq'           => $i,
                'due_date'      => $start->copy()->addMonths($i - 1)->toDateString(),
                'principal_due' => $monthly,
                'interest_due'  => $interestPerMonth,
            ];
        }
        return $rows;
    }

    protected function generateInstallments(Loan $loan): void {
        LoanInstallment::where('loan_id', $loan->id)->delete();
        foreach ($this->buildSchedule($loan) as $row) {
            LoanInstallment::create(array_merge($row, ['loan_id' => $loan->id, 'status' => 'due']));
        }
    }

    protected function postDisbursement(Loan $loan, string $date): void {
        $cash = Account::where('office_id', $loan->office_id)->where('code', '1000')->first();
        $loanAR = Account::where('office_id', $loan->office_id)->where('code', '1200')->first();
        if (!$cash || !$loanAR) return;
        $this->accounting->postJournal($loan->office_id, $date, [
            ['account_id' => $loanAR->id, 'debit'  => (float)$loan->principal, 'credit' => 0, 'memo' => "Loan disbursement {$loan->code}"],
            ['account_id' => $cash->id,   'debit'  => 0, 'credit' => (float)$loan->principal, 'memo' => "Loan disbursement {$loan->code}"],
        ], ['source_type' => 'loan', 'source_id' => $loan->id, 'reference' => $loan->code]);
    }

    /** Allocate a payment amount across the loan installments oldest-first. */
    public function applyPayment(Loan $loan, float $amount, string $paidOn): array {
        $applied = [];
        $remaining = $amount;
        foreach ($loan->installments()->whereIn('status', ['due','partial','overdue'])->get() as $inst) {
            if ($remaining <= 0) break;
            $owe = (float)$inst->principal_due + (float)$inst->interest_due + (float)$inst->delay_fee - (float)$inst->paid;
            if ($owe <= 0) continue;
            $take = min($owe, $remaining);
            $inst->paid    = (float)$inst->paid + $take;
            $inst->status  = ($take >= $owe - 0.01) ? 'paid' : 'partial';
            $inst->paid_on = $paidOn;
            $inst->save();
            $applied[] = ['installment_id' => $inst->id, 'amount' => $take];
            $remaining -= $take;
        }
        $loan->outstanding = max(0, (float)$loan->outstanding - ($amount - $remaining));
        if ($loan->outstanding <= 0.01) $loan->status = 'closed';
        $loan->save();
        return ['applied' => $applied, 'unallocated' => $remaining];
    }
}
