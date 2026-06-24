<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class JournalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $entries = JournalEntry::query()
            ->with('lines.account:id,code,name')
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('from'), fn ($q, $from) => $q->whereDate('entry_date', '>=', $from))
            ->when($request->query('to'), fn ($q, $to) => $q->whereDate('entry_date', '<=', $to))
            ->orderByDesc('entry_date')
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($entries);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entry_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:64'],
            'memo' => ['nullable', 'string'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_id' => ['required', 'string', 'exists:accounts,id'],
            'lines.*.debit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.credit' => ['nullable', 'numeric', 'min:0'],
            'lines.*.memo' => ['nullable', 'string'],
        ]);

        $totalDebit = collect($data['lines'])->sum(fn ($l) => (float) ($l['debit'] ?? 0));
        $totalCredit = collect($data['lines'])->sum(fn ($l) => (float) ($l['credit'] ?? 0));

        if (round($totalDebit, 2) !== round($totalCredit, 2)) {
            abort(422, 'ডেবিট ও ক্রেডিট সমান হতে হবে।');
        }
        if (round($totalDebit, 2) <= 0) {
            abort(422, 'লেনদেনের পরিমাণ শূন্য হতে পারে না।');
        }

        $entry = DB::transaction(function () use ($data, $request) {
            $entry = JournalEntry::create([
                'office_id' => $request->attributes->get('scope_office_id'),
                'entry_date' => $data['entry_date'],
                'reference' => $data['reference'] ?? null,
                'memo' => $data['memo'] ?? null,
                'source_type' => 'manual',
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['lines'] as $line) {
                JournalLine::create([
                    'entry_id' => $entry->id,
                    'account_id' => $line['account_id'],
                    'debit' => (float) ($line['debit'] ?? 0),
                    'credit' => (float) ($line['credit'] ?? 0),
                    'memo' => $line['memo'] ?? null,
                ]);
            }

            return $entry;
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $entry->office_id,
            'action' => 'journal.create',
            'entity_type' => 'journal_entry',
            'entity_id' => $entry->id,
        ]);

        return response()->json($entry->load('lines.account:id,code,name'), 201);
    }
}
