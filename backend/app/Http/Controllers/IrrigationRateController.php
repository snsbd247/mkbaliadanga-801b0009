<?php

namespace App\Http\Controllers;

use App\Models\IrrigationRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IrrigationRateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            IrrigationRate::query()
                ->when($request->query('season_id'), fn ($q, $id) => $q->where('season_id', $id))
                ->orderByDesc('effective_from')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(IrrigationRate::create($this->validateData($request, true)), 201);
    }

    public function update(Request $request, IrrigationRate $irrigationRate): JsonResponse
    {
        $irrigationRate->update($this->validateData($request, false));

        return response()->json($irrigationRate);
    }

    public function destroy(IrrigationRate $irrigationRate): JsonResponse
    {
        $irrigationRate->delete();

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }

    private function validateData(Request $request, bool $required): array
    {
        return $request->validate([
            'season_id' => ['nullable', 'string', 'exists:seasons,id'],
            'category_id' => ['nullable', 'string', 'exists:irrigation_categories,id'],
            'crop' => ['nullable', 'string', 'max:128'],
            'rate_per_decimal' => [$required ? 'required' : 'sometimes', 'numeric'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);
    }
}
