<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Farmer;
use App\Models\Loan;
use App\Models\LoanRepayment;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\SavingsAccount;
use App\Models\SavingsTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $payments = Payment::query()
            ->with('allocations')
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('farmer_id'), fn ($q, $fid) => $q->where('farmer_id', $fid))
            ->when($request->query('q'), fn ($q, $t) => $q->where('receipt_no', 'like', "%{$t}%"))
            ->when($request->query('from'), fn ($q, $f) => $q->whereDate('occurred_at', '>=', $f))
            ->when($request->query('to'), fn ($q, $t) => $q->whereDate('occurred_at', '<=', $t))
            ->orderByDesc('occurred_at')
            ->paginate($perPage);

        return response()->json($payments);
    }

    public function show(Payment $payment): JsonResponse
    {
        return response()->json(['data' => $payment->load('allocations')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'farmer_id' => ['required', 'string', 'exists:farmers,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'in:cash,bank,mobile,cheque'],
            'reference' => ['nullable', 'string', 'max:128'],
            'occurred_at' => ['nullable', 'date'],
            'allocations' => ['required', 'array', 'min:1'],
            'allocations.*.target_type' => ['required', 'in:loan,savings,irrigation_invoice'],
            'allocations.*.target_id' => ['required', 'string'],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0'],
        ]);

        $allocTotal = collect($data['allocations'])->sum(fn ($a) => (float) $a['amount']);
        if (round($allocTotal, 2) !== round((float) $data['amount'], 2)) {
            abort(422, 'বরাদ্দের যোগফল মোট পরিমাণের সমান হতে হবে।');
        }

        $officeId = $request->attributes->get('scope_office_id')
            ?? Farmer::whereKey($data['farmer_id'])->value('office_id');

        $payment = DB::transaction(function () use ($data, $officeId, $request) {
            $payment = Payment::create([
                'office_id' => $officeId,
                'farmer_id' => $data['farmer_id'],
                'receipt_no' => $this->nextReceiptNo(),
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'occurred_at' => $data['occurred_at'] ?? now(),
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['allocations'] as $alloc) {
                $this->applyAllocation($payment, $alloc, $request);
            }

            return $payment;
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $payment->office_id,
            'action' => 'payment.create',
            'entity_type' => 'payment',
            'entity_id' => $payment->id,
        ]);

        return response()->json(['data' => $payment->load('allocations')], 201);
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        DB::transaction(function () use ($payment, $request) {
            foreach ($payment->allocations as $alloc) {
                $this->reverseAllocation($alloc);
            }
            $payment->delete(); // cascades allocations
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $payment->office_id,
            'action' => 'payment.delete',
            'entity_type' => 'payment',
            'entity_id' => $payment->id,
        ]);

        return response()->json(['message' => 'পেমেন্ট বাতিল হয়েছে।']);
    }

    private function applyAllocation(Payment $payment, array $alloc, Request $request): void
    {
        $amount = (float) $alloc['amount'];
        $type = $alloc['target_type'];
        $targetId = $alloc['target_id'];

        PaymentAllocation::create([
            'payment_id' => $payment->id,
            'target_type' => $type,
            'target_id' => $targetId,
            'amount' => $amount,
        ]);

        if ($type === 'loan') {
            $loan = Loan::whereKey($targetId)->lockForUpdate()->firstOrFail();
            $outstanding = max(0, (float) $loan->outstanding - $amount);
            $loan->update([
                'outstanding' => $outstanding,
                'status' => $outstanding <= 0 ? 'closed' : $loan->status,
            ]);
            LoanRepayment::create([
                'loan_id' => $loan->id,
                'amount' => $amount,
                'principal_part' => $amount,
                'outstanding_after' => $outstanding,
                'paid_at' => $payment->occurred_at,
                'note' => "Payment {$payment->receipt_no}",
                'created_by' => $request->user()->id,
            ]);
        } elseif ($type === 'savings') {
            $acc = SavingsAccount::whereKey($targetId)->lockForUpdate()->firstOrFail();
            $balance = (float) $acc->balance + $amount;
            $acc->update(['balance' => $balance]);
            SavingsTransaction::create([
                'account_id' => $acc->id,
                'type' => 'deposit',
                'amount' => $amount,
                'balance_after' => $balance,
                'occurred_at' => $payment->occurred_at,
                'note' => "Payment {$payment->receipt_no}",
                'created_by' => $request->user()->id,
            ]);
        } else { // irrigation_invoice
            $inv = DB::table('irrigation_invoices')->where('id', $targetId)->lockForUpdate()->first();
            if ($inv) {
                $paid = (float) $inv->paid_amount + $amount;
                $due = max(0, (float) $inv->amount - $paid);
                DB::table('irrigation_invoices')->where('id', $targetId)->update([
                    'paid_amount' => $paid,
                    'due_amount' => $due,
                    'status' => $due <= 0 ? 'paid' : 'partial',
                    'updated_at' => now(),
                ]);
                DB::table('irrigation_invoice_payments')->insert([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'invoice_id' => $targetId,
                    'payment_id' => $payment->id,
                    'amount' => $amount,
                    'method' => $payment->method,
                    'receipt_no' => $payment->receipt_no,
                    'paid_at' => $payment->occurred_at,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    private function reverseAllocation(PaymentAllocation $alloc): void
    {
        $amount = (float) $alloc->amount;

        if ($alloc->target_type === 'loan') {
            $loan = Loan::whereKey($alloc->target_id)->lockForUpdate()->first();
            if ($loan) {
                $loan->update([
                    'outstanding' => (float) $loan->outstanding + $amount,
                    'status' => $loan->status === 'closed' ? 'active' : $loan->status,
                ]);
            }
        } elseif ($alloc->target_type === 'savings') {
            $acc = SavingsAccount::whereKey($alloc->target_id)->lockForUpdate()->first();
            if ($acc) {
                $acc->update(['balance' => max(0, (float) $acc->balance - $amount)]);
            }
        } else {
            $inv = DB::table('irrigation_invoices')->where('id', $alloc->target_id)->lockForUpdate()->first();
            if ($inv) {
                $paid = max(0, (float) $inv->paid_amount - $amount);
                $due = max(0, (float) $inv->amount - $paid);
                DB::table('irrigation_invoices')->where('id', $alloc->target_id)->update([
                    'paid_amount' => $paid,
                    'due_amount' => $due,
                    'status' => $paid <= 0 ? 'unpaid' : ($due <= 0 ? 'paid' : 'partial'),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /** Concurrency-safe sequential receipt number (RCP-000001). */
    private function nextReceiptNo(): string
    {
        $last = Payment::query()
            ->where('receipt_no', 'like', 'RCP-%')
            ->lockForUpdate()
            ->orderByDesc('receipt_no')
            ->value('receipt_no');

        $next = $last ? ((int) substr($last, 4)) + 1 : 1;

        return 'RCP-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
