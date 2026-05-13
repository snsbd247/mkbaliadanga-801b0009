<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('assets.read'), 403);
        return Asset::where('office_id', app('current_office_id'))
            ->when($r->status, fn($q,$v) => $q->where('status',$v))
            ->orderByDesc('acquired_on')->paginate((int)($r->per_page ?? 25));
    }
    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('assets.write'), 403);
        $d = $r->validate([
            'category_id' => 'nullable|uuid|exists:asset_categories,id',
            'code'        => 'required|string|max:32|unique:assets,code',
            'name'        => 'required|string|max:191',
            'acquired_on' => 'required|date',
            'cost'        => 'required|numeric|min:0',
            'salvage'     => 'numeric|min:0',
            'life_years'  => 'numeric|min:0.5|max:50',
        ]);
        $d['office_id'] = app('current_office_id');
        return response()->json(Asset::create($d), 201);
    }
    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('assets.write'), 403);
        $a = Asset::where('office_id', app('current_office_id'))->findOrFail($id);
        $a->update($r->only('name','category_id','salvage','life_years','status','meta'));
        return $a;
    }
}
