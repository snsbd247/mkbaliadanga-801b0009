<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $r)
    {
        $data = $r->validate([
            'identifier' => 'required_without:email|string',
            'email'      => 'nullable|string',
            'password'   => 'required|string|min:6',
            'device'     => 'nullable|string|max:64',
        ]);

        $id = $data['identifier'] ?? $data['email'] ?? null;

        $user = User::where('email', $id)->orWhere('username', $id)->first();

        if (!$user || !Hash::check($data['password'], $user->password) || !$user->is_active) {
            throw ValidationException::withMessages([
                'identifier' => ['ভুল লগইন তথ্য / Invalid credentials.'],
            ]);
        }

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $r->ip(),
        ])->save();

        $token = $user->createToken($data['device'] ?? 'web', ['*'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $this->presentUser($user),
        ]);
    }

    public function me(Request $r)
    {
        return response()->json(['user' => $this->presentUser($r->user())]);
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()?->delete();
        return response()->json(['ok' => true]);
    }

    public function logoutAll(Request $r)
    {
        $r->user()->tokens()->delete();
        return response()->json(['ok' => true]);
    }

    private function presentUser(User $user): array
    {
        $user->load('roles:id,name,label', 'office:id,name,code');

        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'email'       => $user->email,
            'username'    => $user->username,
            'office_id'   => $user->office_id,
            'office'      => $user->office,
            'is_active'   => $user->is_active,
            'roles'       => $user->roles->pluck('name'),
            'role_labels' => $user->roles->pluck('label', 'name'),
            'permissions' => $user->allPermissions(),
        ];
    }
}
