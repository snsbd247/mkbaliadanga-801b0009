<?php

namespace App\Http\Controllers;

use App\Models\IrrigationRate;
use Illuminate\Http\Request;

class IrrigationRateController extends Controller
{
    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('irrigation.read'), 403);
        return IrrigationRate::where('office_id', app('current_office_id'))
            ->when($r->season_id, fn($q,$v) => $q->where('season_id',$v))->get();
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('irrigation.rates.manage'), 403);
        $data = $r->validate([
            'season_id'        => 'required|uuid|exists:seasons,id',
            'crop'             => 'nullable|string|max:64',
            'rate_per_decimal' => 'required|numeric|min:0',
            'rate_per_bigha'   => 'nullable|numeric|min:0',
        ]);
        $data['office_id'] = app('current_office_id');
        return response()->json(IrrigationRate::create($data), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('irrigation.rates.manage'), 403);
        $rate = IrrigationRate::where('office_id', app('current_office_id'))->findOrFail($id);
        $rate->update($r->only('crop','rate_per_decimal','rate_per_bigha'));
        return $rate;
    }

    public function destroy(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('irrigation.rates.manage'), 403);
        IrrigationRate::where('office_id', app('current_office_id'))->findOrFail($id)->delete();
        return response()->noContent();
    }
}
