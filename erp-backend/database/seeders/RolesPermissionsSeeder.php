<?php

namespace Database\Seeders;

use App\Models\CustomRole;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Roles
        $roles = [
            'developer'   => 'Developer',
            'super_admin' => 'Super Admin',
            'admin'       => 'Admin',
            'committee'   => 'Committee',
            'accountant'  => 'Accountant',
            'operator'    => 'Operator',
            'staff'       => 'Staff',
            'viewer'      => 'Viewer',
        ];

        foreach ($roles as $name => $label) {
            CustomRole::firstOrCreate(
                ['name' => $name],
                ['id' => (string) Str::uuid(), 'label' => $label]
            );
        }

        // Permissions grouped by module (identifiers strictly lowercase)
        $modules = [
            'dashboard', 'farmers', 'lands', 'irrigation', 'savings', 'loans',
            'shares', 'accounting', 'cashbook', 'bank', 'receipts', 'assets',
            'reports', 'sms', 'users', 'roles', 'settings', 'audit',
        ];
        $actions = ['view', 'add', 'edit', 'delete'];

        $allPermissionIds = [];
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                $perm = Permission::firstOrCreate(
                    ['name' => "{$module}.{$action}"],
                    [
                        'id'    => (string) Str::uuid(),
                        'group' => $module,
                        'label' => ucfirst($module) . ' - ' . ucfirst($action),
                    ]
                );
                $allPermissionIds[] = $perm->id;
            }
        }

        // super_admin & developer get every permission
        foreach (['super_admin', 'developer'] as $roleName) {
            $role = CustomRole::where('name', $roleName)->first();
            $role?->permissions()->syncWithoutDetaching($allPermissionIds);
        }
    }
}
