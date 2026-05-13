<?php

namespace App\Http\Controllers;

use App\Models\JournalEntry;
use App\Services\AccountingService;
use Illuminate\Http\Request;

class JournalController extends Controller
{
    public function __construct(private AccountingService $svc) {}

    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('accounts.read'), 403);
        return JournalEntry::where('office_id', app('current_office_id'))
            ->when($r->from, fn($q,$v) => $q->whereDate('entry_date', '>=', $v))
            ->when($r->to,   fn($q,$v) => $q->whereDate('entry_date', '<=', $v))
            ->with('lines.account:id,code,name')
            ->orderByDesc('entry_date')->paginate((int)($r->per_page ?? 25));
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('accounts.write'), 403);
        $d = $r->validate([
            'entry_date' => 'required|date',
            'memo'       => 'nullable|string',
            'reference'  => 'nullable|string|max:64',
            'lines'      => 'required|array|min:2',
            'lines.*.account_id' => 'required|uuid|exists:accounts,id',
            'lines.*.debit'      => 'required|numeric|min:0',
            'lines.*.credit'     => 'required|numeric|min:0',
            'lines.*.memo'       => 'nullable|string',
        ]);
        $j = $this->svc->postJournal(app('current_office_id'), $d['entry_date'], $d['lines'], [
            'memo' => $d['memo'] ?? null, 'reference' => $d['reference'] ?? null,
            'source_type' => 'manual', 'created_by' => $r->user()->id,
        ]);
        return response()->json($j->load('lines'), 201);
    }
}
