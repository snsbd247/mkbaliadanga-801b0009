<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Farmer;
use App\Models\SavingsAccount;
use App\Models\SavingsTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SavingsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $scopeOffice = $request->attributes->get('scope_office_id');

        $accounts = SavingsAccount::query()
            ->when($scopeOffice, fn ($q) => $q->where('office_id', $scopeOffice))
            ->when($request->query('farmer_id'), fn ($q, $fid) => $q->where('farmer_id', $fid))
            ->when($request->query('q'), function ($q, $term) {
                $q->where('account_no', 'like', "%{$term}%");
            })
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json($accounts);
    }

    public function show(SavingsAccount $saving): JsonResponse
    {
        $saving->load('transactions');

        return response()->json(['data' => $saving]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'farmer_id' => ['required', 'string', 'exists:farmers,id'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
        ]);

        $officeId = $request->attributes->get('scope_office_id')
            ?? Farmer::whereKey($data['farmer_id'])->value('office_id');
        $opening = (float) ($data['opening_balance'] ?? 0);

        $account = DB::transaction(function () use ($data, $officeId, $opening, $request) {
            $account = SavingsAccount::create([
                'farmer_id' => $data['farmer_id'],
                'office_id' => $officeId,
                'account_no' => $this->nextAccountNo(),
                'balance' => $opening,
                'status' => 'active',
                'opened_at' => now(),
            ]);

            if ($opening > 0) {
                SavingsTransaction::create([
                    'account_id' => $account->id,
                    'type' => 'deposit',
                    'amount' => $opening,
                    'balance_after' => $opening,
                    'occurred_at' => now(),
                    'note' => 'প্রারম্ভিক জমা',
                    'created_by' => $request->user()->id,
                ]);
            }

            return $account;
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $account->office_id,
            'action' => 'savings.open',
            'entity_type' => 'savings_account',
            'entity_id' => $account->id,
        ]);

        return response()->json(['data' => $account], 201);
    }

    public function deposit(Request $request, SavingsAccount $saving): JsonResponse
    {
        return $this->applyTxn($request, $saving, 'deposit');
    }

    public function withdraw(Request $request, SavingsAccount $saving): JsonResponse
    {
        return $this->applyTxn($request, $saving, 'withdraw');
    }

    private function applyTxn(Request $request, SavingsAccount $saving, string $type): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $txn = DB::transaction(function () use ($data, $saving, $type, $request) {
            /** @var SavingsAccount $locked */
            $locked = SavingsAccount::whereKey($saving->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'active') {
                abort(422, 'অ্যাকাউন্টটি সক্রিয় নয়।');
            }

            $amount = (float) $data['amount'];
            $balance = (float) $locked->balance;

            if ($type === 'withdraw') {
                if ($amount > $balance) {
                    abort(422, 'পর্যাপ্ত ব্যালেন্স নেই।');
                }
                $balance -= $amount;
            } else {
                $balance += $amount;
            }

            $locked->update(['balance' => $balance]);

            return SavingsTransaction::create([
                'account_id' => $locked->id,
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $balance,
                'occurred_at' => now(),
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
            ]);
        });

        AuditLog::record([
            'user_id' => $request->user()->id,
            'office_id' => $saving->office_id,
            'action' => "savings.{$type}",
            'entity_type' => 'savings_account',
            'entity_id' => $saving->id,
        ]);

        return response()->json(['data' => $txn], 201);
    }

    /** Concurrency-safe sequential account number (SAV-000001). */
    private function nextAccountNo(): string
    {
        $last = SavingsAccount::query()
            ->where('account_no', 'like', 'SAV-%')
            ->lockForUpdate()
            ->orderByDesc('account_no')
            ->value('account_no');

        $next = $last ? ((int) substr($last, 4)) + 1 : 1;

        return 'SAV-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
