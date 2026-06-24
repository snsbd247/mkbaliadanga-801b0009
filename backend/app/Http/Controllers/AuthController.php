<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        $user = User::query()
            ->where('username', $identifier)
            ->orWhere('email', $identifier)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'identifier' => ['ভুল ইউজারনেম বা পাসওয়ার্ড।'],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'identifier' => ['এই অ্যাকাউন্টটি নিষ্ক্রিয়।'],
            ]);
        }

        $token = $user->createToken($data['device'] ?? 'web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
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
            'roles' => $user->roles()->pluck('role'),
            'permissions' => $user->permissionList(),
        ];
    }
}
