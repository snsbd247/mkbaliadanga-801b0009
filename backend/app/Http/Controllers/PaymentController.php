<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $svc) {}

    public function index(Request $r) {
        $this->authorize('viewAny', Payment::class);
        return Payment::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->when($r->kind,      fn($q,$v) => $q->where('kind',$v))
            ->when($r->from,      fn($q,$v) => $q->whereDate('paid_on', '>=', $v))
            ->when($r->to,        fn($q,$v) => $q->whereDate('paid_on', '<=', $v))
            ->with('farmer:id,code,name')
            ->orderByDesc('paid_on')->paginate((int)($r->per_page ?? 25));
    }

    public function show(string $id) {
        $p = Payment::where('office_id', app('current_office_id'))->with('farmer')->findOrFail($id);
        $this->authorize('view', $p);
        return $p;
    }

    public function store(Request $r) {
        $this->authorize('create', Payment::class);
        $data = $r->validate([
            'farmer_id'   => 'required|uuid|exists:farmers,id',
            'kind'        => 'required|string|in:irrigation,loan,savings_deposit,share,fee,other',
            'amount'      => 'required|numeric|min:0.01',
            'paid_on'     => 'required|date',
            'method'      => 'required|string|in:cash,bkash,nagad,bank',
            'note'        => 'nullable|string',
            'allocations' => 'array',
            'allocations.*.target_type' => 'required_with:allocations|string|in:irrigation_invoice,loan,savings,fee',
            'allocations.*.target_id'   => 'nullable|uuid',
            'allocations.*.amount'      => 'required_with:allocations|numeric|min:0.01',
        ]);
        return response()->json($this->svc->record(
            app('current_office_id'), $data['farmer_id'], $data['kind'], (float)$data['amount'],
            $data['paid_on'], $data['method'], $data['allocations'] ?? [], $r->user()->id, $data['note'] ?? null,
        ), 201);
    }

    public function destroy(string $id) {
        $p = Payment::where('office_id', app('current_office_id'))->findOrFail($id);
        $this->authorize('delete', $p);
        $p->delete();
        return response()->noContent();
    }
}
