<?php

namespace App\Http\Controllers;

use App\Models\SavingsTransaction;
use App\Services\ReceiptNumberService;
use Illuminate\Http\Request;

class SavingsController extends Controller
{
    public function __construct(private ReceiptNumberService $receiptNo) {}

    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = SavingsTransaction::query()
            ->with('farmer:id,name,code')
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('farmer_id'), fn ($q) => $q->where('farmer_id', $r->input('farmer_id')))
            ->when($r->filled('type'), fn ($q) => $q->where('type', $r->input('type')))
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'farmer_id' => 'required|string',
            'amount'    => 'required|numeric|min:0.01',
            'type'      => 'nullable|in:deposit,withdraw',
            'plan_id'   => 'nullable|string',
            'txn_date'  => 'nullable|date',
        ]);

        $officeId = $r->attributes->get('scope_office_id');
        $receiptNo = $this->receiptNo->next($officeId, 'monthly');

        $txn = SavingsTransaction::create([
            'office_id'  => $officeId,
            'farmer_id'  => $data['farmer_id'],
            'plan_id'    => $data['plan_id'] ?? null,
            'type'       => $data['type'] ?? 'deposit',
            'amount'     => $data['amount'],
            'receipt_no' => $receiptNo,
            'txn_date'   => $data['txn_date'] ?? now()->toDateString(),
            'created_by' => $r->user()->id,
        ]);

        return response()->json($txn, 201);
    }
}
