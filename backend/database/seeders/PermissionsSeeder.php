<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds every permission key used by route middleware (`permission:*`).
 * Idempotent — safe to re-run. Super admin keeps the wildcard `*`.
 */
class PermissionsSeeder extends Seeder
{
    /** module => [actions...] (key becomes "module.action"). */
    private array $modules = [
        'users' => ['view', 'manage'],
        'roles' => ['view', 'manage'],
        'offices' => ['view', 'manage'],
        'audit' => ['view'],
        'farmers' => ['view', 'manage'],
        'lands' => ['view', 'manage'],
        'irrigation' => ['view', 'manage'],
        'savings' => ['view', 'manage'],
        'loans' => ['view', 'manage'],
        'accounting' => ['view', 'manage'],
        'assets' => ['view', 'manage'],
        'payments' => ['view', 'manage'],
        'sms' => ['view', 'manage'],
        'qr' => ['view', 'manage'],
    ];

    public function run(): void
    {
        foreach ($this->modules as $module => $actions) {
            foreach ($actions as $action) {
                Permission::query()->firstOrCreate(
                    ['key' => "{$module}.{$action}"],
                    [
                        'id' => (string) Str::uuid(),
                        'module' => $module,
                        'description' => ucfirst($module) . ' — ' . $action,
                    ],
                );
            }
        }
    }
}
