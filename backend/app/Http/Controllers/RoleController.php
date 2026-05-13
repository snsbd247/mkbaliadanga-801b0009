<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index() { return Role::with('permissions:id,name')->orderBy('name')->get(); }
    public function permissions() { return Permission::orderBy('group')->orderBy('name')->get(); }

    public function syncPermissions(Request $r, string $id) {
        abort_unless($r->user()->hasRole('super_admin'), 403);
        $role = Role::findOrFail($id);
        $d = $r->validate(['permissions' => 'array', 'permissions.*' => 'uuid|exists:permissions,id']);
        $role->permissions()->sync($d['permissions'] ?? []);
        return $role->load('permissions:id,name');
    }
}
