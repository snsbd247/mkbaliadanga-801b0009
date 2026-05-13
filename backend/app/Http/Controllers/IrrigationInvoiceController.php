<?php

namespace App\Http\Controllers;

use App\Models\IrrigationInvoice;
use App\Services\IrrigationService;
use Illuminate\Http\Request;

class IrrigationInvoiceController extends Controller
{
    public function __construct(private IrrigationService $svc) {}

    public function index(Request $r) {
        $this->authorize('viewAny', IrrigationInvoice::class);
        return IrrigationInvoice::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->when($r->season_id, fn($q,$v) => $q->where('season_id',$v))
            ->when($r->status,    fn($q,$v) => $q->where('status',$v))
            ->with('farmer:id,code,name,mobile')
            ->orderByDesc('invoice_date')->paginate((int)($r->per_page ?? 25));
    }

    public function show(string $id) {
        $inv = IrrigationInvoice::where('office_id', app('current_office_id'))->with('farmer','season')->findOrFail($id);
        $this->authorize('view', $inv);
        return $inv;
    }

    public function store(Request $r) {
        $this->authorize('create', IrrigationInvoice::class);
        $data = $r->validate([
            'farmer_id'    => 'required|uuid|exists:farmers,id',
            'season_id'    => 'required|uuid|exists:seasons,id',
            'land_id'      => 'nullable|uuid|exists:lands,id',
            'area_decimal' => 'required|numeric|min:0.01',
            'invoice_date' => 'required|date',
            'due_date'     => 'nullable|date|after_or_equal:invoice_date',
            'rate'         => 'nullable|numeric|min:0',
        ]);
        return response()->json($this->svc->generateInvoice(
            app('current_office_id'), $data['farmer_id'], $data['season_id'],
            $data['land_id'] ?? null, (float)$data['area_decimal'], $data['invoice_date'],
            isset($data['rate']) ? (float)$data['rate'] : null, $data['due_date'] ?? null,
        ), 201);
    }

    public function destroy(string $id) {
        $inv = IrrigationInvoice::where('office_id', app('current_office_id'))->findOrFail($id);
        $this->authorize('update', $inv);
        abort_if((float)$inv->paid > 0, 422, 'Cannot delete an invoice with payments.');
        $inv->delete();
        return response()->noContent();
    }
}
