<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $r) {
        $data = $r->validate([
            'email'    => 'required|email',
            'password' => 'required|string|min:6',
            'device'   => 'nullable|string|max:64',
        ]);
        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], $user->password) || !$user->is_active) {
            throw ValidationException::withMessages(['email' => ['Invalid credentials.']]);
        }
        $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $r->ip()])->save();
        $token = $user->createToken($data['device'] ?? 'web', ['*'], now()->addDays(30))->plainTextToken;
        return response()->json([
            'token' => $token,
            'user'  => $user->load('roles:id,name,label'),
        ]);
    }

    public function me(Request $r) {
        return response()->json($r->user()->load('roles:id,name,label','office'));
    }

    public function logout(Request $r) {
        $r->user()->currentAccessToken()?->delete();
        return response()->json(['ok' => true]);
    }

    public function logoutAll(Request $r) {
        $r->user()->tokens()->delete();
        return response()->json(['ok' => true]);
    }
}
