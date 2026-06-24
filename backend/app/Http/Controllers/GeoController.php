<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Models\Division;
use App\Models\LandType;
use App\Models\Mouza;
use App\Models\Union;
use App\Models\Upazila;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GeoController extends Controller
{
    public function divisions(): JsonResponse
    {
        return response()->json(Division::query()->orderBy('name')->get());
    }

    public function districts(Request $request): JsonResponse
    {
        return response()->json(
            District::query()
                ->when($request->query('division_id'), fn ($q, $id) => $q->where('division_id', $id))
                ->orderBy('name')->get()
        );
    }

    public function upazilas(Request $request): JsonResponse
    {
        return response()->json(
            Upazila::query()
                ->when($request->query('district_id'), fn ($q, $id) => $q->where('district_id', $id))
                ->orderBy('name')->get()
        );
    }

    public function unions(Request $request): JsonResponse
    {
        return response()->json(
            Union::query()
                ->when($request->query('upazila_id'), fn ($q, $id) => $q->where('upazila_id', $id))
                ->orderBy('name')->get()
        );
    }

    public function mouzas(Request $request): JsonResponse
    {
        return response()->json(
            Mouza::query()
                ->when($request->query('union_id'), fn ($q, $id) => $q->where('union_id', $id))
                ->orderBy('name')->get()
        );
    }

    public function landTypes(): JsonResponse
    {
        return response()->json(LandType::query()->where('is_active', true)->orderBy('name')->get());
    }
}
