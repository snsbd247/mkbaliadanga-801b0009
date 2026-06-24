<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\IrrigationInvoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IrrigationInvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $invoices = IrrigationInvoice::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('farmer_id'), fn ($q, $id) => $q->where('farmer_id', $id))
            ->when($request->query('season_id'), fn ($q, $id) => $q->where('season_id', $id))
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('issue_date')
            ->paginate($perPage);

        return response()->json($invoices);
    }

    public function show(IrrigationInvoice $invoice): JsonResponse
    {
        return response()->json($invoice->load('payments', 'farmer'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'farmer_id' => ['required', 'string', 'exists:farmers,id'],
            'season_id' => ['nullable', 'string', 'exists:seasons,id'],
            'land_id' => ['nullable', 'string'],
            'invoice_no' => ['nullable', 'string', 'max:64'],
            'area_decimal' => ['nullable', 'numeric'],
            'rate_per_decimal' => ['nullable', 'numeric'],
            'amount' => ['required', 'numeric', 'min:0'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
        ]);

        $data['office_id'] = $request->attributes->get('scope_office_id');
        $data['due_amount'] = $data['amount'];
        $data['status'] = 'unpaid';

        $invoice = IrrigationInvoice::create($data);

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $invoice->office_id,
            'action' => 'irrigation_invoice.create',
            'entity_type' => 'irrigation_invoice',
            'entity_id' => $invoice->id,
        ]);

        return response()->json($invoice, 201);
    }

    public function destroy(Request $request, IrrigationInvoice $invoice): JsonResponse
    {
        $id = $invoice->id;
        $office = $invoice->office_id;
        $invoice->delete();

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $office,
            'action' => 'irrigation_invoice.delete',
            'entity_type' => 'irrigation_invoice',
            'entity_id' => $id,
        ]);

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }
}
