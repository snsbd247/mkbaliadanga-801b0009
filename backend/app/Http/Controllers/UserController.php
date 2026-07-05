<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $perPage = (int) $request->query('per_page', 20);

        $scopeOffice = $request->attributes->get('scope_office_id');

        $users = User::query()
            ->with(['roles:id,name'])
            ->when($scopeOffice, fn ($query) => $query->where('office_id', $scopeOffice))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($w) use ($q) {
                    $w->where('name', 'like', "%{$q}%")
                        ->orWhere('username', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%")
                        ->orWhere('phone', 'like', "%{$q}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'username' => ['required', 'string', 'max:64', 'unique:users,username'],
            'email' => ['nullable', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['required', 'string', 'min:6'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data['password'] = Hash::make($data['password']);
        $user = User::create($data);

        AuditLog::record([
            'user_id' => $request->user()->id,
            'action' => 'user.create',
            'entity_type' => 'user',
            'entity_id' => $user->id,
        ]);

        return response()->json($user->load('roles:id,name'), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:191'],
            'username' => ['sometimes', 'string', 'max:64', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['nullable', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:32'],
            'password' => ['nullable', 'string', 'min:6'],
            'office_id' => ['nullable', 'string', 'exists:offices,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $passwordChanged = false;
        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
            $passwordChanged = true;
        } else {
            unset($data['password']);
        }

        $user->update($data);

        if ($passwordChanged) {
            \App\Support\CanonicalAdmins::auditPasswordChange(
                $user,
                'user.password.changed',
                'Password changed by admin via user management.',
                $request->user()->id,
            );
        }

        AuditLog::record([
            'user_id' => $request->user()->id,
            'action' => 'user.update',
            'entity_type' => 'user',
            'entity_id' => $user->id,
        ]);

        return response()->json($user->load('roles:id,name'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'নিজের অ্যাকাউন্ট মুছে ফেলা যাবে না।'], 422);
        }

        $user->delete();

        AuditLog::record([
            'user_id' => $request->user()->id,
            'action' => 'user.delete',
            'entity_type' => 'user',
            'entity_id' => $user->id,
        ]);

        return response()->json(['message' => 'মুছে ফেলা হয়েছে।']);
    }

    public function assignRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role_id' => ['required', 'string', 'exists:roles,id'],
        ]);

        $user->roles()->syncWithoutDetaching([$data['role_id']]);

        return response()->json($user->load('roles:id,name'));
    }

    public function removeRole(User $user, Role $role): JsonResponse
    {
        $user->roles()->detach($role->id);

        return response()->json($user->load('roles:id,name'));
    }
}
