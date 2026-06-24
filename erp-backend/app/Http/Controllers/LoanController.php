<?php

namespace App\Http\Controllers;

use App\Models\Loan;
use App\Models\LoanPayment;
use App\Services\ReceiptNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoanController extends Controller
{
    public function __construct(private ReceiptNumberService $receiptNo) {}

    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = Loan::query()
            ->with('farmer:id,name,code')
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('farmer_id'), fn ($q) => $q->where('farmer_id', $r->input('farmer_id')))
            ->when($r->filled('status'), fn ($q) => $q->where('status', $r->input('status')))
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function show(Loan $loan)
    {
        return response()->json($loan->load('farmer:id,name,code', 'payments'));
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'farmer_id' => 'required|string',
            'principal' => 'required|numeric|min:0.01',
        ]);
        $payload = array_merge($r->except(['id']), $data);
        $payload['office_id'] = $payload['office_id'] ?? $r->attributes->get('scope_office_id');
        $payload['outstanding'] = $data['principal'];
        $payload['created_by'] = $r->user()->id;

        $loan = Loan::create($payload);
        return response()->json($loan, 201);
    }

    public function collect(Request $r, Loan $loan)
    {
        $data = $r->validate([
            'amount'         => 'required|numeric|min:0.01',
            'principal_part' => 'nullable|numeric',
            'interest_part'  => 'nullable|numeric',
            'paid_at'        => 'nullable|date',
        ]);

        $officeId = $loan->office_id ?? $r->attributes->get('scope_office_id');

        return DB::transaction(function () use ($r, $loan, $data, $officeId) {
            $receiptNo = $this->receiptNo->next($officeId, 'monthly');

            $payment = LoanPayment::create([
                'office_id'      => $officeId,
                'loan_id'        => $loan->id,
                'farmer_id'      => $loan->farmer_id,
                'receipt_no'     => $receiptNo,
                'amount'         => $data['amount'],
                'principal_part' => $data['principal_part'] ?? $data['amount'],
                'interest_part'  => $data['interest_part'] ?? 0,
                'paid_at'        => $data['paid_at'] ?? now()->toDateString(),
                'created_by'     => $r->user()->id,
            ]);

            $loan->paid = (float) $loan->paid + (float) $data['amount'];
            $loan->outstanding = max(0, (float) $loan->outstanding - (float) ($data['principal_part'] ?? $data['amount']));
            $loan->status = $loan->outstanding <= 0 ? 'closed' : 'active';
            $loan->save();

            return response()->json(['payment' => $payment, 'loan' => $loan, 'receipt_no' => $receiptNo], 201);
        });
    }
}
