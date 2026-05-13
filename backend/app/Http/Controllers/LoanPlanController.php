<?php

namespace App\Http\Controllers;

use App\Models\LoanPlan;
use Illuminate\Http\Request;

class LoanPlanController extends Controller
{
    public function index() {
        return LoanPlan::where('office_id', app('current_office_id'))->orderBy('name')->get();
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('loans.write'), 403);
        $data = $r->validate([
            'name' => 'required|string|max:191',
            'interest_pct' => 'numeric|min:0|max:100',
            'default_term_months' => 'integer|min:1|max:240',
            'processing_fee' => 'numeric|min:0',
            'delay_fee_pct' => 'numeric|min:0|max:100',
            'rules' => 'nullable|array',
            'is_active' => 'boolean',
        ]);
        $data['office_id'] = app('current_office_id');
        return response()->json(LoanPlan::create($data), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('loans.write'), 403);
        $plan = LoanPlan::where('office_id', app('current_office_id'))->findOrFail($id);
        $plan->update($r->only('name','interest_pct','default_term_months','processing_fee','delay_fee_pct','rules','is_active'));
        return $plan;
    }

    public function destroy(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('loans.write'), 403);
        LoanPlan::where('office_id', app('current_office_id'))->findOrFail($id)->delete();
        return response()->noContent();
    }
}
