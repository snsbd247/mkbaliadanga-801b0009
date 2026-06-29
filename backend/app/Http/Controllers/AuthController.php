<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\CanonicalAdmins;
use App\Support\SanctumTokenSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /api/login
     * Accepts username OR email + password, returns a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            // Frontend sends `identifier`; accept `login` as a fallback alias.
            'identifier' => ['required_without:login', 'string'],
            'login' => ['required_without:identifier', 'string'],
            'password' => ['required', 'string'],
            'device' => ['sometimes', 'string'],
        ]);

        $identifier = $data['identifier'] ?? $data['login'];
        try {
            $user = User::query()
                ->where('username', $identifier)
                ->orWhere('email', $identifier)
                ->first();

            if (! $user || ! Hash::check($data['password'], $user->password)) {
                throw ValidationException::withMessages([
                    'identifier' => ['ভুল ইউজারনেম বা পাসওয়ার্ড।'],
                ]);
            }

            // Server-side autofix: if this is a canonical admin account whose
            // required role went missing, reattach it before issuing the token.
            try {
                CanonicalAdmins::ensureRole($user);
                $user->refresh();
            } catch (\Throwable $e) {
                // Never let the role-autofix break login; just log and continue.
                Log::warning('CanonicalAdmins::ensureRole failed during login: '.$e->getMessage());
            }

            if (! $user->is_active) {
                throw ValidationException::withMessages([
                    'identifier' => ['এই অ্যাকাউন্টটি নিষ্ক্রিয়।'],
                ]);
            }

            try {
                $token = $this->issueToken($user, $data['device'] ?? 'web');
            } catch (\Throwable $e) {
                Log::warning('Initial API token creation failed during login; attempting repair.', [
                    'user_id' => $user->id,
                    'username' => $user->username,
                    'error' => $e->getMessage(),
                ]);

                try {
                    SanctumTokenSchema::ensureUuidTokenableId();
                    if (CanonicalAdmins::isCanonical($user->username)) {
                        CanonicalAdmins::fix();
                    }
                    $user->refresh();
                    $token = $this->issueToken($user, $data['device'] ?? 'web');
                } catch (\Throwable $retryError) {
                    Log::error('API token creation failed after repair attempt during login: '.$retryError->getMessage(), [
                        'user_id' => $user->id,
                        'username' => $user->username,
                        'first_error' => $e->getMessage(),
                    ]);

                    return response()->json([
                        'message' => 'লগইন সেশন তৈরি করা যায়নি। VPS-এ bash scripts/update.sh চালান; তারপর php backend/artisan admin:verify --fix চালিয়ে আবার চেষ্টা করুন।',
                    ], 500);
                }
            }

            return response()->json([
                'token' => $token,
                'user' => $this->userPayload($user->fresh() ?? $user),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Unexpected login failure: '.$e->getMessage(), [
                'identifier' => $identifier,
            ]);

            return response()->json([
                'message' => 'লগইন করার সময় সার্ভারে সমস্যা হয়েছে। VPS-এ bash scripts/update.sh চালিয়ে আবার চেষ্টা করুন।',
            ], 500);
        }
    }

    /**
     * GET /api/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    /**
     * POST /api/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'লগ আউট সম্পন্ন হয়েছে।']);
    }

    /**
     * POST /api/auth/logout-all — revoke every token for the user.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'সব ডিভাইস থেকে লগ আউট হয়েছে।']);
    }

    /**
     * POST /api/auth/password/forgot — issue a single-use reset token.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::where('email', $data['email'])->first();
        $payload = ['message' => 'রিসেট নির্দেশনা পাঠানো হয়েছে (যদি অ্যাকাউন্ট থাকে)।'];

        if ($user) {
            $token = \Illuminate\Support\Str::random(64);
            \Illuminate\Support\Facades\DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $user->email],
                ['token' => Hash::make($token), 'created_at' => now()]
            );
            // No mailer configured: expose token only in non-production for delivery via app/SMS.
            if (config('app.debug')) {
                $payload['token'] = $token;
            }
        }

        return response()->json($payload);
    }

    /**
     * POST /api/auth/password/reset — consume token and set new password.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $record = \Illuminate\Support\Facades\DB::table('password_reset_tokens')
            ->where('email', $data['email'])->first();

        if (! $record || ! Hash::check($data['token'], $record->token)) {
            throw ValidationException::withMessages(['token' => ['টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।']]);
        }

        if (now()->diffInMinutes($record->created_at) > 60) {
            throw ValidationException::withMessages(['token' => ['টোকেনের মেয়াদ শেষ হয়েছে।']]);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->update(['password' => Hash::make($data['password'])]);
        $user->tokens()->delete();

        \Illuminate\Support\Facades\DB::table('password_reset_tokens')
            ->where('email', $data['email'])->delete();

        return response()->json(['message' => 'পাসওয়ার্ড পরিবর্তন হয়েছে।']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'office_id' => $user->office_id,
            'is_active' => $user->is_active,
            'roles' => $user->roleNames(),
            'permissions' => $user->permissionList(),
        ];
    }

    private function issueToken(User $user, string $device): string
    {
        SanctumTokenSchema::ensureUuidTokenableId();

        return $user->createToken($device)->plainTextToken;
    }
}
