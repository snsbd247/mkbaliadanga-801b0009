<?php

namespace App\Http\Controllers;

use App\Models\SavingsAccount;
use App\Services\SavingsService;
use Illuminate\Http\Request;

class SavingsController extends Controller
{
    public function __construct(private SavingsService $svc) {}

    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('savings.read'), 403);
        return SavingsAccount::where('office_id', app('current_office_id'))
            ->when($r->farmer_id, fn($q,$v) => $q->where('farmer_id',$v))
            ->with('farmer:id,code,name,mobile')
            ->orderByDesc('opened_on')->paginate((int)($r->per_page ?? 25));
    }

    public function show(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('savings.read'), 403);
        return SavingsAccount::where('office_id', app('current_office_id'))
            ->with(['farmer','transactions' => fn($q) => $q->latest('tx_date')->limit(200)])
            ->findOrFail($id);
    }

    public function open(Request $r) {
        abort_unless($r->user()->hasPermission('savings.write'), 403);
        $data = $r->validate(['farmer_id' => 'required|uuid|exists:farmers,id', 'code' => 'nullable|string|max:32']);
        return response()->json($this->svc->openAccount(app('current_office_id'), $data['farmer_id'], $data['code'] ?? null), 201);
    }

    public function deposit(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('savings.write'), 403);
        $a = SavingsAccount::where('office_id', app('current_office_id'))->findOrFail($id);
        $data = $r->validate(['amount' => 'required|numeric|min:0.01', 'tx_date' => 'required|date', 'memo' => 'nullable|string']);
        return response()->json($this->svc->deposit($a, (float)$data['amount'], $data['tx_date'], $r->user()->id, $data['memo'] ?? null), 201);
    }

    public function withdraw(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('savings.write'), 403);
        $a = SavingsAccount::where('office_id', app('current_office_id'))->findOrFail($id);
        $data = $r->validate(['amount' => 'required|numeric|min:0.01', 'tx_date' => 'required|date', 'memo' => 'nullable|string']);
        return response()->json($this->svc->withdraw($a, (float)$data['amount'], $data['tx_date'], $r->user()->id, $data['memo'] ?? null), 201);
    }
}
