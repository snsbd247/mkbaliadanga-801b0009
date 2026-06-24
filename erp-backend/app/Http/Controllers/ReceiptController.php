<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Receipt;
use App\Services\ReceiptNumberService;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function index(Request $r)
    {
        $officeId = $r->attributes->get('scope_office_id');
        $isGlobal = $r->attributes->get('scope_is_global');

        $q = Receipt::query()
            ->when(!$isGlobal && $officeId, fn ($q) => $q->where('office_id', $officeId))
            ->when($r->filled('search'), fn ($q) => $q->where('receipt_no', 'like', "%{$r->input('search')}%"))
            ->when($r->filled('kind'), fn ($q) => $q->where('kind', $r->input('kind')))
            ->when($r->filled('from'), fn ($q) => $q->whereDate('created_at', '>=', $r->input('from')))
            ->when($r->filled('to'), fn ($q) => $q->whereDate('created_at', '<=', $r->input('to')))
            ->orderByDesc('created_at');

        return response()->json($q->paginate((int) $r->input('per_page', 25)));
    }

    public function show(Receipt $receipt)
    {
        return response()->json($receipt);
    }

    /** Reserve and return the next receipt number for concurrency health checks. */
    public function previewNumber(Request $r, ReceiptNumberService $numbers)
    {
        $data = $r->validate([
            'kind' => 'nullable|in:monthly,unified',
        ]);

        $officeId = $r->attributes->get('scope_office_id') ?: $r->user()?->office_id;

        if (!$officeId) {
            return response()->json(['message' => 'Office scope is required.'], 422);
        }

        $number = $numbers->next($officeId, $data['kind'] ?? 'monthly');

        return response()->json([
            'receipt_no' => $number,
            'number' => $number,
            'reserved' => true,
        ]);
    }

    /** Void a receipt (keeps the number reserved, marks the linked payment void). */
    public function void(Request $r, Receipt $receipt)
    {
        $receipt->is_void = true;
        $receipt->save();

        if ($receipt->payment_id) {
            Payment::where('id', $receipt->payment_id)->update(['is_void' => true]);
        }

        return response()->json(['ok' => true, 'receipt' => $receipt]);
    }
}
