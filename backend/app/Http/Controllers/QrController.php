<?php

namespace App\Http\Controllers;

use App\Models\QrToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class QrController extends Controller
{
    public function issue(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject_type' => ['required', 'string', 'max:64'],
            'subject_id' => ['required', 'string', 'max:36'],
            'ttl_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $token = QrToken::create([
            'office_id' => $request->attributes->get('scope_office_id'),
            'subject_type' => $data['subject_type'],
            'subject_id' => $data['subject_id'],
            'token' => Str::random(48),
            'expires_at' => isset($data['ttl_days']) ? now()->addDays($data['ttl_days']) : null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($token, 201);
    }

    public function revoke(QrToken $qr): JsonResponse
    {
        $qr->update(['revoked_at' => now()]);

        return response()->json(['message' => 'টোকেন বাতিল হয়েছে।']);
    }

    public function resolve(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string']]);

        $qr = QrToken::where('token', $data['token'])->first();

        if (! $qr || ! $qr->isValid()) {
            return response()->json(['message' => 'টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।'], 404);
        }

        return response()->json([
            'subject_type' => $qr->subject_type,
            'subject_id' => $qr->subject_id,
            'expires_at' => $qr->expires_at,
        ]);
    }
}
