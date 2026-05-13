<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Jobs\SendSmsJob;
use App\Models\Farmer;
use App\Models\FarmerCredential;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class FarmerAuthController extends Controller
{
    public function requestOtp(Request $r) {
        $data = $r->validate(['mobile' => 'required|string|min:10']);
        $farmer = Farmer::where('mobile', $data['mobile'])->where('is_active', true)->first();
        if (!$farmer) throw ValidationException::withMessages(['mobile' => 'Farmer not found.']);

        $otp = (string) random_int(100000, 999999);
        $cred = FarmerCredential::firstOrNew(['farmer_id' => $farmer->id]);
        $cred->otp_code       = Hash::make($otp);
        $cred->otp_expires_at = Carbon::now()->addMinutes(5);
        $cred->otp_attempts   = 0;
        $cred->save();

        SendSmsJob::dispatch($farmer->mobile, "Your MK Baliadanga OTP is: $otp (5 min)", 'farmer_otp', $farmer->id, $farmer->office_id);
        return response()->json(['ok' => true, 'expires_in' => 300]);
    }

    public function verifyOtp(Request $r) {
        $data = $r->validate([
            'mobile' => 'required|string',
            'otp'    => 'required|string|size:6',
        ]);
        $farmer = Farmer::where('mobile', $data['mobile'])->firstOrFail();
        $cred = $farmer->credentials;
        if (!$cred || !$cred->otp_code || !$cred->otp_expires_at || $cred->otp_expires_at->isPast()) {
            throw ValidationException::withMessages(['otp' => 'OTP expired.']);
        }
        if ($cred->otp_attempts >= 5) throw ValidationException::withMessages(['otp' => 'Too many attempts.']);
        if (!Hash::check($data['otp'], $cred->otp_code)) {
            $cred->increment('otp_attempts');
            throw ValidationException::withMessages(['otp' => 'Invalid OTP.']);
        }
        $cred->forceFill([
            'otp_code' => null, 'otp_expires_at' => null, 'otp_attempts' => 0, 'last_login_at' => now(),
        ])->save();
        $token = $farmer->createToken('farmer-portal', ['farmer:self'], now()->addDays(7))->plainTextToken;
        return response()->json(['token' => $token, 'farmer' => $farmer]);
    }
}
