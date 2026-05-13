<?php

namespace App\Services;

use App\Models\Account;
use App\Models\IrrigationInvoice;
use App\Models\Loan;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Payment allocation:
 *   allocations = [
 *     ['target_type' => 'irrigation_invoice'|'loan'|'savings'|'fee', 'target_id' => uuid, 'amount' => float],
 *     ...
 *   ]
 */
class PaymentService
{
    public function __construct(private AccountingService $accounting, private LoanService $loanSvc) {}

    public function record(string $officeId, string $farmerId, string $kind, float $amount, string $paidOn, string $method, array $allocations, ?string $userId, ?string $note = null): Payment {
        return DB::transaction(function () use ($officeId, $farmerId, $kind, $amount, $paidOn, $method, $allocations, $userId, $note) {
            $allocSum = round(array_sum(array_column($allocations, 'amount')), 2);
            abort_if($allocations && abs($allocSum - $amount) > 0.01, 422, "Allocations ($allocSum) must equal amount ($amount).");

            $payment = Payment::create([
                'office_id'   => $officeId, 'farmer_id' => $farmerId, 'kind' => $kind,
                'amount'      => $amount,   'paid_on'   => $paidOn,    'method' => $method,
                'note'        => $note,     'collected_by' => $userId,
                'receipt_no'  => 'RCP-'.now()->format('ymd').'-'.strtoupper(Str::random(6)),
                'allocations' => $allocations,
            ]);

            foreach ($allocations as $a) {
                $this->applyAllocation($payment, $a);
            }
            $this->postPaymentJournal($payment);
            return $payment->refresh();
        });
    }

    protected function applyAllocation(Payment $p, array $a): void {
        switch ($a['target_type']) {
            case 'irrigation_invoice':
                $inv = IrrigationInvoice::where('office_id', $p->office_id)->findOrFail($a['target_id']);
                $inv->paid = (float)$inv->paid + (float)$a['amount'];
                $inv->status = $inv->paid >= (float)$inv->total - 0.01 ? 'paid' : 'partial';
                $inv->save();
                break;
            case 'loan':
                $loan = Loan::where('office_id', $p->office_id)->findOrFail($a['target_id']);
                $this->loanSvc->applyPayment($loan, (float)$a['amount'], $p->paid_on->toDateString());
                break;
            // savings / fee: ledger only — no row to update here
        }
    }

    protected function postPaymentJournal(Payment $p): void {
        $cash = Account::where('office_id', $p->office_id)->where('code', $p->method === 'bank' ? '1010' : '1000')->first();
        if (!$cash) return;
        $lines = [['account_id' => $cash->id, 'debit' => (float)$p->amount, 'credit' => 0, 'memo' => "Payment {$p->receipt_no}"]];
        foreach ($p->allocations as $a) {
            $code = match ($a['target_type']) {
                'irrigation_invoice' => '1100',   // AR irrigation
                'loan'               => '1200',   // Loan AR
                'savings'            => '2000',   // Savings liability (credit)
                'fee'                => '4200',   // Delay fee income
                default              => null,
            };
            if (!$code) continue;
            $acct = Account::where('office_id', $p->office_id)->where('code', $code)->first();
            if (!$acct) continue;
            $lines[] = ['account_id' => $acct->id, 'debit' => 0, 'credit' => (float)$a['amount'], 'memo' => "Pay alloc {$a['target_type']}"];
        }
        $debit  = array_sum(array_column($lines, 'debit'));
        $credit = array_sum(array_column($lines, 'credit'));
        if (abs($debit - $credit) > 0.01) return; // skip if accounts missing
        $this->accounting->postJournal($p->office_id, $p->paid_on->toDateString(), $lines, [
            'source_type' => 'payment', 'source_id' => $p->id, 'reference' => $p->receipt_no, 'memo' => 'Payment',
        ]);
    }
}
