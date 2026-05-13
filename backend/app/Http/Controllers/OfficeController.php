<?php

namespace App\Http\Controllers;

use App\Models\Office;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    public function index(Request $r) {
        return $r->user()->hasRole('super_admin')
            ? Office::orderBy('name')->get()
            : Office::where('id', app('current_office_id'))->get();
    }
    public function store(Request $r) {
        abort_unless($r->user()->hasRole('super_admin'), 403);
        $d = $r->validate([
            'code' => 'required|string|max:32|unique:offices,code',
            'name' => 'required|string|max:191',
            'name_bn' => 'nullable|string',
            'address' => 'nullable|string',
            'phone' => 'nullable|string|max:32',
        ]);
        return response()->json(Office::create($d + ['is_active' => true]), 201);
    }
    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasRole('super_admin'), 403);
        $o = Office::findOrFail($id);
        $o->update($r->only('name','name_bn','address','phone','settings','is_active'));
        return $o;
    }
}
