<?php

namespace App\Http\Controllers;

use App\Models\Loan;
use App\Services\LoanService;
use Illuminate\Http\Request;

class LoanController extends Controller
{
    public function __construct(private LoanService $svc) {}

    public function index(Request $r) {
        $this->authorize('viewAny', Loan::class);
        return Loan::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->when($r->status,    fn($q,$v) => $q->where('status',$v))
            ->with('farmer:id,code,name')
            ->orderByDesc('created_at')->paginate((int)($r->per_page ?? 25));
    }

    public function show(string $id) {
        $loan = Loan::where('office_id', app('current_office_id'))->with(['farmer','installments','plan'])->findOrFail($id);
        $this->authorize('view', $loan);
        return $loan;
    }

    public function store(Request $r) {
        $this->authorize('create', Loan::class);
        $data = $r->validate([
            'farmer_id'    => 'required|uuid|exists:farmers,id',
            'plan_id'      => 'nullable|uuid|exists:loan_plans,id',
            'principal'    => 'required|numeric|min:1',
            'interest_pct' => 'nullable|numeric|min:0|max:100',
            'term_months'  => 'nullable|integer|min:1|max:240',
            'first_due_on' => 'nullable|date',
            'code'         => 'nullable|string|max:32',
        ]);
        return response()->json($this->svc->create(app('current_office_id'), $data), 201);
    }

    public function approve(Request $r, string $id) {
        $loan = Loan::where('office_id', app('current_office_id'))->findOrFail($id);
        $this->authorize('approve', $loan);
        $data = $r->validate(['disbursed_on' => 'required|date']);
        return $this->svc->approve($loan, $r->user()->id, $data['disbursed_on']);
    }

    public function destroy(string $id) {
        $loan = Loan::where('office_id', app('current_office_id'))->findOrFail($id);
        $this->authorize('update', $loan);
        abort_if($loan->status !== 'pending', 422, 'Only pending loans can be deleted.');
        $loan->delete();
        return response()->noContent();
    }
}
