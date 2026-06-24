<?php

namespace App\Http\Controllers;

use App\Models\Land;
use Illuminate\Http\Request;

class LandController extends Controller
{
    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = Land::query()
            ->with('farmer:id,name,code')
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('farmer_id'), fn ($q) => $q->where('farmer_id', $r->input('farmer_id')))
            ->when($r->filled('search'), function ($q) use ($r) {
                $s = $r->input('search');
                $q->where(function ($w) use ($s) {
                    $w->where('dag_no', 'like', "%{$s}%")
                      ->orWhere('khatian_no', 'like', "%{$s}%")
                      ->orWhere('owner_name', 'like', "%{$s}%");
                });
            })
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function show(Land $land)
    {
        return response()->json($land->load('farmer:id,name,code', 'landType:id,name'));
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'farmer_id'   => 'nullable|string',
            'dag_no'      => 'nullable|string|max:64',
            'katha'       => 'nullable|numeric',
            'shatak'      => 'nullable|numeric',
            'land_status' => 'nullable|string|max:32',
            'office_id'   => 'nullable|string',
        ]);

        $payload = array_merge($r->except(['id', 'created_by']), $data);
        $payload['office_id'] = $payload['office_id'] ?? $r->attributes->get('scope_office_id');
        $payload['created_by'] = $r->user()->id;

        $land = Land::create($payload);

        return response()->json($land, 201);
    }

    public function update(Request $r, Land $land)
    {
        $land->fill($r->except(['id', 'created_by', 'office_id']))->save();
        return response()->json($land);
    }

    public function destroy(Land $land)
    {
        $land->delete();
        return response()->json(['ok' => true]);
    }
}
