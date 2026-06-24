<?php

namespace App\Http\Controllers;

use App\Models\IrrigationInvoice;
use App\Models\IrrigationInvoicePayment;
use App\Services\ReceiptNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IrrigationInvoiceController extends Controller
{
    public function __construct(private ReceiptNumberService $receiptNo) {}

    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = IrrigationInvoice::query()
            ->with('farmer:id,name,code')
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('farmer_id'), fn ($q) => $q->where('farmer_id', $r->input('farmer_id')))
            ->when($r->filled('season_id'), fn ($q) => $q->where('season_id', $r->input('season_id')))
            ->when($r->filled('status'), fn ($q) => $q->where('status', $r->input('status')))
            ->when($r->filled('search'), fn ($q) => $q->where('invoice_no', 'like', "%{$r->input('search')}%"))
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function show(IrrigationInvoice $invoice)
    {
        return response()->json($invoice->load('farmer:id,name,code', 'payments'));
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'farmer_id' => 'required|string',
            'amount'    => 'required|numeric',
            'season_id' => 'nullable|string',
        ]);
        $payload = array_merge($r->except(['id']), $data);
        $payload['office_id'] = $payload['office_id'] ?? $r->attributes->get('scope_office_id');
        $payload['due'] = ($payload['amount'] ?? 0) + ($r->input('maintenance', 0)) + ($r->input('canal', 0));
        $payload['created_by'] = $r->user()->id;

        $invoice = IrrigationInvoice::create($payload);
        return response()->json($invoice, 201);
    }

    /** Collect a payment against an invoice and mint a month-wise receipt no. */
    public function collect(Request $r, IrrigationInvoice $invoice)
    {
        $data = $r->validate([
            'amount'    => 'required|numeric|min:0.01',
            'delay_fee' => 'nullable|numeric',
            'method'    => 'nullable|string|max:32',
            'paid_at'   => 'nullable|date',
        ]);

        $officeId = $invoice->office_id ?? $r->attributes->get('scope_office_id');

        return DB::transaction(function () use ($r, $invoice, $data, $officeId) {
            $receiptNo = $this->receiptNo->next($officeId, 'monthly');

            $payment = IrrigationInvoicePayment::create([
                'office_id'  => $officeId,
                'invoice_id' => $invoice->id,
                'farmer_id'  => $invoice->farmer_id,
                'receipt_no' => $receiptNo,
                'amount'     => $data['amount'],
                'delay_fee'  => $data['delay_fee'] ?? 0,
                'method'     => $data['method'] ?? 'cash',
                'paid_at'    => $data['paid_at'] ?? now()->toDateString(),
                'created_by' => $r->user()->id,
            ]);

            $invoice->paid = (float) $invoice->paid + (float) $data['amount'];
            $invoice->due = max(0, (float) $invoice->due - (float) $data['amount']);
            $invoice->status = $invoice->due <= 0 ? 'paid' : 'partial';
            $invoice->save();

            return response()->json(['payment' => $payment, 'invoice' => $invoice, 'receipt_no' => $receiptNo], 201);
        });
    }
}
