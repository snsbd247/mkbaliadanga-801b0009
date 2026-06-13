<?php

namespace App\Http\Controllers;

use App\Models\OfficeIncome;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OfficeIncomeController extends Controller
{
    public function index(Request $r) {
        $q = OfficeIncome::where('office_id', app('current_office_id'));
        if ($r->filled('stream')) $q->where('stream', $r->stream);
        if ($r->filled('income_type')) $q->where('income_type', $r->income_type);
        return $q->orderByDesc('received_on')->limit(500)->get();
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('accounting.write'), 403);
        $d = $r->validate([
            'income_type' => 'nullable|in:scrap,hawlat,grant,other',
            'payer_name'  => 'required|string|max:191',
            'amount'      => 'required|numeric|min:0.01',
            'received_on' => 'nullable|date',
            'stream'      => 'nullable|in:sech,saving',
            'note'        => 'nullable|string',
        ]);
        $d['office_id']  = app('current_office_id');
        // Farmer-less receipt on the irrigation (IRR) serial.
        $d['receipt_no'] = 'IRR-'.now()->format('ymd').'-'.strtoupper(Str::random(5));
        $d['created_by'] = $r->user()->id;
        return response()->json(OfficeIncome::create($d), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('accounting.write'), 403);
        $o = OfficeIncome::where('office_id', app('current_office_id'))->findOrFail($id);
        $o->update($r->only('income_type','payer_name','amount','received_on','stream','note'));
        return $o;
    }

    public function destroy(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('accounting.write'), 403);
        OfficeIncome::where('office_id', app('current_office_id'))->findOrFail($id)->delete();
        return response()->noContent();
    }
}
