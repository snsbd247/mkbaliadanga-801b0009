<?php

namespace App\Http\Controllers;

use App\Models\Farmer;
use Illuminate\Http\Request;

class FarmerController extends Controller
{
    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = Farmer::query()
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('office_id') && $isGlobal, fn ($q) => $q->where('office_id', $r->input('office_id')))
            ->when($r->filled('search'), function ($q) use ($r) {
                $s = $r->input('search');
                $q->where(function ($w) use ($s) {
                    $w->where('name', 'like', "%{$s}%")
                      ->orWhere('bn_name', 'like', "%{$s}%")
                      ->orWhere('code', 'like', "%{$s}%")
                      ->orWhere('nid', 'like', "%{$s}%")
                      ->orWhere('phone', 'like', "%{$s}%");
                });
            })
            ->when($r->filled('status'), fn ($q) => $q->where('status', $r->input('status')))
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function show(Request $r, Farmer $farmer)
    {
        return response()->json($farmer->load('lands'));
    }

    public function store(Request $r)
    {
        $data = $r->validate([
            'name'      => 'required|string|max:255',
            'phone'     => 'nullable|string|max:32',
            'nid'       => 'nullable|string|max:32',
            'office_id' => 'nullable|string',
            'code'      => 'nullable|string|max:64',
            'status'    => 'nullable|string|max:32',
        ]);

        $data['office_id'] = $data['office_id'] ?? $r->attributes->get('scope_office_id');
        $data['created_by'] = $r->user()->id;
        $data = array_merge($r->except(['id', 'created_by']), $data);

        $farmer = Farmer::create($data);

        return response()->json($farmer, 201);
    }

    public function update(Request $r, Farmer $farmer)
    {
        $r->validate(['name' => 'sometimes|required|string|max:255']);
        $farmer->fill($r->except(['id', 'created_by', 'office_id']))->save();
        return response()->json($farmer);
    }

    public function destroy(Farmer $farmer)
    {
        $farmer->delete();
        return response()->json(['ok' => true]);
    }
}
