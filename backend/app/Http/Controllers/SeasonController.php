<?php

namespace App\Http\Controllers;

use App\Models\Season;
use Illuminate\Http\Request;

class SeasonController extends Controller
{
    public function index() {
        return Season::where('office_id', app('current_office_id'))->orderByDesc('start_date')->get();
    }
    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('settings.write'), 403);
        $d = $r->validate([
            'name' => 'required|string|max:191',
            'name_bn' => 'nullable|string',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'is_active'  => 'boolean',
            'rates'      => 'nullable|array',
        ]);
        $d['office_id'] = app('current_office_id');
        return response()->json(Season::create($d), 201);
    }
    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('settings.write'), 403);
        $s = Season::where('office_id', app('current_office_id'))->findOrFail($id);
        $s->update($r->only('name','name_bn','start_date','end_date','is_active','rates'));
        return $s;
    }
    public function activate(string $id) {
        $s = Season::where('office_id', app('current_office_id'))->findOrFail($id);
        Season::where('office_id', app('current_office_id'))->update(['is_active' => false]);
        $s->update(['is_active' => true]);
        return $s;
    }
}
