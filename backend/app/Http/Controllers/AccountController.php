<?php

namespace App\Http\Controllers;

use App\Models\Account;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('accounts.read'), 403);
        return Account::where(function ($q) {
                $q->whereNull('office_id')->orWhere('office_id', app('current_office_id'));
            })
            ->orderBy('code')->get();
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('accounts.write'), 403);
        $d = $r->validate([
            'code'      => 'required|string|max:32',
            'name'      => 'required|string|max:191',
            'name_bn'   => 'nullable|string',
            'type'      => 'required|in:asset,liability,equity,income,expense',
            'parent_id' => 'nullable|uuid|exists:accounts,id',
            'is_active' => 'boolean',
        ]);
        $d['office_id'] = app('current_office_id');
        return response()->json(Account::create($d), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('accounts.write'), 403);
        $a = Account::where('office_id', app('current_office_id'))->findOrFail($id);
        $a->update($r->only('name','name_bn','type','parent_id','is_active'));
        return $a;
    }
}
