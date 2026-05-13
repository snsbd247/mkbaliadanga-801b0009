<?php

namespace App\Http\Controllers;

use App\Models\Land;
use Illuminate\Http\Request;

class LandController extends Controller
{
    public function index(Request $r) {
        return Land::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->orderBy('created_at','desc')->paginate((int)($r->per_page ?? 50));
    }
    public function store(Request $r) {
        $d = $r->validate([
            'farmer_id'    => 'required|uuid|exists:farmers,id',
            'dag_no'       => 'nullable|string|max:64',
            'khatian_no'   => 'nullable|string|max:64',
            'area_decimal' => 'required|numeric|min:0.01',
            'village_id'   => 'nullable|uuid',
            'crop'         => 'nullable|string',
        ]);
        $d['office_id'] = app('current_office_id');
        return response()->json(Land::create($d), 201);
    }
    public function update(Request $r, string $id) {
        $l = Land::where('office_id', app('current_office_id'))->findOrFail($id);
        $l->update($r->only('dag_no','khatian_no','area_decimal','village_id','crop','meta'));
        return $l;
    }
    public function destroy(string $id) {
        Land::where('office_id', app('current_office_id'))->findOrFail($id)->delete();
        return response()->noContent();
    }
}
