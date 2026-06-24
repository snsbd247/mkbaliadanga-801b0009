<?php

namespace App\Http\Controllers;

use App\Models\LoanPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoanPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $scopeOffice = $request->attributes->get('scope_office_id');

        $plans = LoanPlan::query()
            ->when($scopeOffice, fn ($q) => $q->where(function ($w) use ($scopeOffice) {
                $w->where('office_id', $scopeOffice)->orWhereNull('office_id');
            }))
            ->orderBy('name')
            ->get();

        return response()->json($plans);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, required: true);
        $data['office_id'] ??= $request->attributes->get('scope_office_id');

        return response()->json(LoanPlan::create($data), 201);
    }

    public function update(Request $request, LoanPlan $loanPlan): JsonResponse
    {
        $loanPlan->update($this->validateData($request, required: false));

        return response()->json($loanPlan);
    }

    public function destroy(LoanPlan $loanPlan): JsonResponse
    {
        $loanPlan->delete();

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'name' => [$required ? 'required' : 'sometimes', 'string', 'max:128'],
            'principal' => ['nullable', 'numeric', 'min:0'],
            'interest_rate' => ['nullable', 'numeric', 'min:0'],
            'tenure_months' => ['nullable', 'integer', 'min:0'],
            'processing_fee' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
        ]);
    }
}
