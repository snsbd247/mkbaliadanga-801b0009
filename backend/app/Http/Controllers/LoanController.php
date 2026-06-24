<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Farmer;
use App\Models\Loan;
use App\Models\LoanPlan;
use App\Models\LoanRepayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $loans = Loan::query()
            ->with('plan')
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('farmer_id'), fn ($q, $fid) => $q->where('farmer_id', $fid))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($loans);
    }

    public function show(Loan $loan): JsonResponse
    {
        $loan->load(['plan', 'repayments', 'farmer']);

        return response()->json(['data' => $loan]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'farmer_id' => ['required', 'string', 'exists:farmers,id'],
            'loan_plan_id' => ['nullable', 'string', 'exists:loan_plans,id'],
            'principal' => ['required', 'numeric', 'gt:0'],
            'interest_rate' => ['nullable', 'numeric', 'min:0'],
            'tenure_months' => ['nullable', 'integer', 'min:0'],
            'disbursed_at' => ['nullable', 'date'],
        ]);

        $officeId = $request->attributes->get('scope_office_id')
            ?? Farmer::whereKey($data['farmer_id'])->value('office_id');

        if (! empty($data['loan_plan_id'])) {
            $plan = LoanPlan::find($data['loan_plan_id']);
            $data['interest_rate'] ??= $plan?->interest_rate;
            $data['tenure_months'] ??= $plan?->tenure_months;
        }

        $loan = DB::transaction(function () use ($data, $officeId) {
            return Loan::create([
                'farmer_id' => $data['farmer_id'],
                'loan_plan_id' => $data['loan_plan_id'] ?? null,
                'office_id' => $officeId,
                'loan_no' => $this->nextLoanNo(),
                'principal' => $data['principal'],
                'interest_rate' => $data['interest_rate'] ?? 0,
                'tenure_months' => $data['tenure_months'] ?? 0,
                'outstanding' => $data['principal'],
                'status' => 'active',
                'disbursed_at' => $data['disbursed_at'] ?? now(),
            ]);
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $loan->office_id,
            'action' => 'loan.create',
            'entity_type' => 'loan',
            'entity_id' => $loan->id,
        ]);

        return response()->json(['data' => $loan], 201);
    }

    public function repay(Request $request, Loan $loan): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'interest_part' => ['nullable', 'numeric', 'min:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $repayment = DB::transaction(function () use ($data, $loan, $request) {
            /** @var Loan $locked */
            $locked = Loan::whereKey($loan->id)->lockForUpdate()->firstOrFail();

            $amount = (float) $data['amount'];
            $interest = (float) ($data['interest_part'] ?? 0);
            $principalPart = max(0, $amount - $interest);
            $outstanding = max(0, (float) $locked->outstanding - $principalPart);

            $locked->update([
                'outstanding' => $outstanding,
                'status' => $outstanding <= 0 ? 'closed' : $locked->status,
            ]);

            return LoanRepayment::create([
                'loan_id' => $locked->id,
                'amount' => $amount,
                'interest_part' => $interest,
                'principal_part' => $principalPart,
                'outstanding_after' => $outstanding,
                'paid_at' => now(),
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
            ]);
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $loan->office_id,
            'action' => 'loan.repay',
            'entity_type' => 'loan',
            'entity_id' => $loan->id,
        ]);

        return response()->json(['data' => $repayment], 201);
    }

    private function nextLoanNo(): string
    {
        $last = Loan::query()
            ->where('loan_no', 'like', 'LN-%')
            ->lockForUpdate()
            ->orderByDesc('loan_no')
            ->value('loan_no');

        $next = $last ? ((int) substr($last, 3)) + 1 : 1;

        return 'LN-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
