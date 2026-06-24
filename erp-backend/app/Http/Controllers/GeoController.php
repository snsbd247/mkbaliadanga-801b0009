<?php

namespace App\Http\Controllers;

use App\Models\District;
use App\Models\Division;
use App\Models\LandType;
use App\Models\Mouza;
use App\Models\Patwari;
use App\Models\Union;
use App\Models\Upazila;
use Illuminate\Http\Request;

/**
 * Read-only geography + catalog lookups for dropdowns.
 */
class GeoController extends Controller
{
    public function divisions()
    {
        return response()->json(Division::orderBy('name')->get());
    }

    public function districts(Request $r)
    {
        return response()->json(
            District::when($r->filled('division_id'), fn ($q) => $q->where('division_id', $r->input('division_id')))
                ->orderBy('name')->get()
        );
    }

    public function upazilas(Request $r)
    {
        return response()->json(
            Upazila::when($r->filled('district_id'), fn ($q) => $q->where('district_id', $r->input('district_id')))
                ->orderBy('name')->get()
        );
    }

    public function unions(Request $r)
    {
        return response()->json(
            Union::when($r->filled('upazila_id'), fn ($q) => $q->where('upazila_id', $r->input('upazila_id')))
                ->orderBy('name')->get()
        );
    }

    public function mouzas(Request $r)
    {
        return response()->json(
            Mouza::when($r->filled('union_id'), fn ($q) => $q->where('union_id', $r->input('union_id')))
                ->orderBy('name')->get()
        );
    }

    public function patwaris(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        return response()->json(
            Patwari::when($officeId, fn ($q) => $q->where('office_id', $officeId))
                ->where('is_active', true)->orderBy('name')->get()
        );
    }

    public function landTypes(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        return response()->json(
            LandType::when($officeId, fn ($q) => $q->where('office_id', $officeId))
                ->where('is_active', true)->orderBy('name')->get()
        );
    }
}
