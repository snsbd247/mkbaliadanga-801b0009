<?php

namespace App\Http\Controllers;

use App\Models\Farmer;
use App\Models\SmsLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FarmerAuthController extends Controller
{
    /** POST /api/farmer/auth/login — code + mobile (no OTP). */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string'],
            'mobile' => ['required', 'string'],
        ]);

        $farmer = Farmer::where('code', $data['code'])
            ->where('phone', $data['mobile'])
            ->first();

        if (! $farmer) {
            throw ValidationException::withMessages(['code' => ['কোড বা মোবাইল নম্বর ভুল।']]);
        }

        return $this->tokenResponse($farmer);
    }

    /** POST /api/farmer/auth/request-otp */
    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['mobile' => ['required', 'string', 'max:32']]);

        $farmer = Farmer::where('phone', $data['mobile'])->first();
        $payload = ['message' => 'ওটিপি পাঠানো হয়েছে (যদি নম্বর নিবন্ধিত থাকে)।'];

        if ($farmer) {
            $otp = (string) random_int(100000, 999999);
            DB::table('farmer_otps')->where('mobile', $data['mobile'])->delete();
            DB::table('farmer_otps')->insert([
                'id' => (string) Str::uuid(),
                'mobile' => $data['mobile'],
                'otp_hash' => Hash::make($otp),
                'expires_at' => now()->addMinutes(5),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            SmsLog::create([
                'office_id' => $farmer->office_id,
                'to' => $data['mobile'],
                'body' => "আপনার ওটিপি: {$otp} (৫ মিনিট মেয়াদ)",
                'status' => 'queued',
            ]);

            if (config('app.debug')) {
                $payload['otp'] = $otp;
            }
        }

        return response()->json($payload);
    }

    /** POST /api/farmer/auth/verify-otp */
    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string'],
            'otp' => ['required', 'string'],
        ]);

        $record = DB::table('farmer_otps')
            ->where('mobile', $data['mobile'])
            ->whereNull('consumed_at')
            ->orderByDesc('created_at')
            ->first();

        if (! $record || ($record->expires_at && now()->greaterThan($record->expires_at))) {
            throw ValidationException::withMessages(['otp' => ['ওটিপি মেয়াদোত্তীর্ণ। আবার চেষ্টা করুন।']]);
        }
        if ($record->attempts >= 5) {
            throw ValidationException::withMessages(['otp' => ['অনেকবার ভুল হয়েছে। নতুন ওটিপি নিন।']]);
        }
        if (! Hash::check($data['otp'], $record->otp_hash)) {
            DB::table('farmer_otps')->where('id', $record->id)->increment('attempts');
            throw ValidationException::withMessages(['otp' => ['ভুল ওটিপি।']]);
        }

        DB::table('farmer_otps')->where('id', $record->id)->update(['consumed_at' => now()]);

        $farmer = Farmer::where('phone', $data['mobile'])->firstOrFail();

        return $this->tokenResponse($farmer);
    }

    /** GET /api/farmer/me */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['farmer' => $this->farmerPayload($request->user())]);
    }

    private function tokenResponse(Farmer $farmer): JsonResponse
    {
        $token = $farmer->createToken('farmer-portal', ['farmer'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'farmer' => $this->farmerPayload($farmer),
        ]);
    }

    private function farmerPayload(Farmer $farmer): array
    {
        return [
            'id' => $farmer->id,
            'name' => $farmer->name,
            'mobile' => $farmer->phone,
            'office_id' => $farmer->office_id,
            'code' => $farmer->code,
        ];
    }
}
