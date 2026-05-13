<?php

namespace App\Http\Controllers;

use App\Models\Farmer;
use App\Models\QrToken;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class QrController extends Controller
{
    public function issue(Request $r) {
        abort_unless($r->user()->hasPermission('qr.rotate'), 403);
        $d = $r->validate([
            'farmer_id'  => 'required|uuid|exists:farmers,id',
            'purpose'    => 'nullable|in:card,payment,verify',
            'ttl_days'   => 'nullable|integer|min:1|max:365',
        ]);
        $farmer = Farmer::where('office_id', app('current_office_id'))->findOrFail($d['farmer_id']);
        QrToken::where('farmer_id', $farmer->id)->where('purpose', $d['purpose'] ?? 'card')
            ->whereNull('revoked_at')->update(['revoked_at' => now()]);
        $token = QrToken::create([
            'farmer_id' => $farmer->id,
            'token'     => Str::random(64),
            'purpose'   => $d['purpose'] ?? 'card',
            'issued_at' => now(),
            'expires_at'=> Carbon::now()->addDays($d['ttl_days'] ?? 365),
        ]);
        return response()->json($token, 201);
    }

    public function resolve(Request $r) {
        $d = $r->validate(['token' => 'required|string']);
        $tok = QrToken::where('token', $d['token'])->whereNull('revoked_at')
            ->where(fn($q) => $q->whereNull('expires_at')->orWhere('expires_at','>',now()))
            ->firstOrFail();
        $farmer = Farmer::find($tok->farmer_id);
        return ['purpose' => $tok->purpose, 'farmer' => $farmer?->only('id','code','name','name_bn','mobile','village_id')];
    }

    public function revoke(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('qr.rotate'), 403);
        $tok = QrToken::findOrFail($id);
        $tok->update(['revoked_at' => now()]);
        return response()->noContent();
    }
}
