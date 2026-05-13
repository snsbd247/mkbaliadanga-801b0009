<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $r) {
        abort_unless($r->user()->hasPermission('users.read'), 403);
        return User::with('roles:id,name')
            ->when(!$r->user()->hasRole('super_admin'), fn($q) => $q->where('office_id', app('current_office_id')))
            ->orderBy('name')->paginate((int)($r->per_page ?? 25));
    }

    public function store(Request $r) {
        abort_unless($r->user()->hasPermission('users.write'), 403);
        $d = $r->validate([
            'name'      => 'required|string|max:191',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:8',
            'phone'     => 'nullable|string|max:32',
            'office_id' => 'nullable|uuid|exists:offices,id',
            'role'      => 'nullable|string|exists:roles,name',
        ]);
        $u = User::create([
            'name' => $d['name'], 'email' => $d['email'], 'password' => Hash::make($d['password']),
            'phone' => $d['phone'] ?? null, 'office_id' => $d['office_id'] ?? app('current_office_id'),
            'is_active' => true,
        ]);
        if (!empty($d['role'])) {
            $role = Role::where('name', $d['role'])->first();
            if ($role) $u->roles()->attach($role->id, ['office_id' => $u->office_id]);
        }
        return response()->json($u->load('roles:id,name'), 201);
    }

    public function update(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('users.write'), 403);
        $u = User::findOrFail($id);
        $d = $r->validate([
            'name'      => 'sometimes|string|max:191',
            'phone'     => 'nullable|string|max:32',
            'is_active' => 'boolean',
            'password'  => 'sometimes|string|min:8',
            'office_id' => 'nullable|uuid|exists:offices,id',
        ]);
        if (isset($d['password'])) $d['password'] = Hash::make($d['password']);
        $u->update($d);
        return $u->load('roles:id,name');
    }

    public function assignRole(Request $r, string $id) {
        abort_unless($r->user()->hasPermission('users.assign_roles'), 403);
        $u = User::findOrFail($id);
        $d = $r->validate(['role' => 'required|string|exists:roles,name', 'office_id' => 'nullable|uuid|exists:offices,id']);
        $role = Role::where('name', $d['role'])->firstOrFail();
        $u->roles()->syncWithoutDetaching([$role->id => ['office_id' => $d['office_id'] ?? $u->office_id]]);
        return $u->load('roles:id,name');
    }

    public function removeRole(Request $r, string $id, string $roleId) {
        abort_unless($r->user()->hasPermission('users.assign_roles'), 403);
        User::findOrFail($id)->roles()->detach($roleId);
        return response()->noContent();
    }

    public function destroy(Request $r, string $id) {
        abort_unless($r->user()->hasRole('super_admin'), 403);
        abort_if($r->user()->id === $id, 422, 'Cannot delete yourself.');
        User::findOrFail($id)->delete();
        return response()->noContent();
    }
}
