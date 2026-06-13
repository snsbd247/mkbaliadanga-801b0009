<?php

namespace App\Http\Controllers;

use App\Models\BankAccount;
use App\Models\BankTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class BankController extends Controller
{
    public function index() {
        return BankAccount::where('office_id', app('current_office_id'))
            ->orderBy('bank_name')->get();
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('settings.write'), 403);
        $d = $r->validate([
            'bank_name'       => 'required|string|max:191',
            'branch'          => 'nullable|string',
            'account_no'      => 'required|string|max:64',
            'account_title'   => 'nullable|string',
            'account_type'    => 'nullable|string|max:32',
            'opening_balance' => 'nullable|numeric',
            'stream'          => 'nullable|in:sech,sech_small,saving,other',
            'is_active'       => 'boolean',
        ]);
        $d['office_id'] = app('current_office_id');
        return response()->json(BankAccount::create($d), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('settings.write'), 403);
        $a = BankAccount::where('office_id', app('current_office_id'))->findOrFail($id);
        $a->update($r->only('bank_name','branch','account_no','account_title','account_type','opening_balance','stream','is_active'));
        return $a;
    }

    /** Side-by-side balances grouped by stream (4-account mapping). */
    public function streams() {
        $office = app('current_office_id');
        $accounts = BankAccount::where('office_id', $office)->get();
        $streams = ['sech','sech_small','saving','other'];
        $out = [];
        foreach ($streams as $s) {
            $rows = $accounts->where('stream', $s);
            $opening = (float) $rows->sum('opening_balance');
            $current = $opening;
            foreach ($rows as $acc) {
                $current += (float) BankTransaction::where('bank_account_id', $acc->id)
                    ->whereIn('txn_type', ['deposit','transfer_in'])->sum('amount');
                $current -= (float) BankTransaction::where('bank_account_id', $acc->id)
                    ->whereIn('txn_type', ['withdraw','transfer_out'])->sum('amount');
            }
            $out[$s] = [
                'accounts'        => $rows->values(),
                'opening_balance' => $opening,
                'current_balance' => $current,
            ];
        }
        return $out;
    }

    public function transactions(Request $r) {
        $q = BankTransaction::query()
            ->whereHas('account', fn ($x) => $x->where('office_id', app('current_office_id')));
        if ($r->filled('bank_account_id')) $q->where('bank_account_id', $r->bank_account_id);
        return $q->orderByDesc('txn_date')->limit(500)->get();
    }

    public function storeTransaction(Request $r) {
        abort_unless($r->user()->hasPermission('accounting.write'), 403);
        $d = $r->validate([
            'bank_account_id' => 'required|uuid|exists:bank_accounts,id',
            'txn_date'        => 'nullable|date',
            'txn_type'        => 'required|in:deposit,withdraw',
            'amount'          => 'required|numeric|min:0.01',
            'reference_no'    => 'nullable|string|max:64',
            'note'            => 'nullable|string',
        ]);
        $d['office_id']  = app('current_office_id');
        $d['created_by'] = $r->user()->id;
        return response()->json(BankTransaction::create($d), 201);
    }

    /** Move money between two bank accounts as a linked pair. */
    public function transfer(Request $r) {
        abort_unless($r->user()->hasPermission('accounting.write'), 403);
        $d = $r->validate([
            'from_account_id' => 'required|uuid|exists:bank_accounts,id|different:to_account_id',
            'to_account_id'   => 'required|uuid|exists:bank_accounts,id',
            'amount'          => 'required|numeric|min:0.01',
            'txn_date'        => 'nullable|date',
            'reference_no'    => 'nullable|string|max:64',
            'note'            => 'nullable|string',
        ]);
        $office = app('current_office_id');
        $group  = (string) Str::uuid();
        $date   = $d['txn_date'] ?? now()->toDateString();
        return DB::transaction(function () use ($d, $office, $group, $date, $r) {
            $out = BankTransaction::create([
                'office_id' => $office, 'bank_account_id' => $d['from_account_id'],
                'txn_date' => $date, 'txn_type' => 'transfer_out', 'amount' => $d['amount'],
                'reference_no' => $d['reference_no'] ?? null, 'counterparty_account_id' => $d['to_account_id'],
                'transfer_group' => $group, 'note' => $d['note'] ?? null, 'created_by' => $r->user()->id,
            ]);
            $in = BankTransaction::create([
                'office_id' => $office, 'bank_account_id' => $d['to_account_id'],
                'txn_date' => $date, 'txn_type' => 'transfer_in', 'amount' => $d['amount'],
                'reference_no' => $d['reference_no'] ?? null, 'counterparty_account_id' => $d['from_account_id'],
                'transfer_group' => $group, 'note' => $d['note'] ?? null, 'created_by' => $r->user()->id,
            ]);
            return response()->json(['transfer_group' => $group, 'out' => $out, 'in' => $in], 201);
        });
    }
}
