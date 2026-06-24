<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Role::query()->orderBy('name')->get(['id', 'name', 'description'])
        );
    }

    public function permissions(): JsonResponse
    {
        return response()->json(
            Permission::query()->orderBy('module')->orderBy('key')->get(['id', 'key', 'module'])
        );
    }

    public function syncPermissions(Request $request, Role $role): JsonResponse
    {
        $data = $request->validate([
            'permission_ids' => ['present', 'array'],
            'permission_ids.*' => ['string', 'exists:permissions,id'],
        ]);

        $role->permissions()->sync($data['permission_ids']);

        return response()->json($role->load('permissions:id,key,module'));
    }
}
