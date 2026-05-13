<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesPermissionsSeeder extends Seeder {
    public function run(): void {
        $perms = [
            'farmers'   => ['read','write','delete'],
            'lands'     => ['read','write','delete'],
            'loans'     => ['read','write','approve','delete'],
            'savings'   => ['read','write'],
            'irrigation'=> ['read','write','rates.manage'],
            'payments'  => ['read','write','delete'],
            'accounts'  => ['read','write','close_period'],
            'reports'   => ['read','export'],
            'sms'       => ['read','send','settings'],
            'qr'        => ['read','rotate'],
            'assets'    => ['read','write','depreciate'],
            'users'     => ['read','write','assign_roles'],
            'audit'     => ['read'],
            'settings'  => ['read','write'],
        ];
        $created = [];
        foreach ($perms as $group => $actions) {
            foreach ($actions as $a) {
                $name = "$group.$a";
                $created[$name] = Permission::firstOrCreate(['name' => $name], ['group' => $group, 'label' => ucfirst($group).' '.$a]);
            }
        }

        $roles = [
            'super_admin' => array_keys($created),                  // every permission
            'admin'       => array_filter(array_keys($created), fn($p) => !str_starts_with($p, 'users.assign_roles')),
            'manager'     => ['farmers.read','farmers.write','loans.read','loans.write','loans.approve','irrigation.read','irrigation.write','payments.read','payments.write','reports.read','reports.export','sms.send'],
            'accountant'  => ['accounts.read','accounts.write','accounts.close_period','payments.read','payments.write','reports.read','reports.export','assets.read','assets.depreciate'],
            'operator'    => ['farmers.read','farmers.write','irrigation.read','irrigation.write','payments.read','payments.write','sms.send'],
            'viewer'      => ['farmers.read','loans.read','irrigation.read','payments.read','reports.read'],
            'developer'   => array_keys($created),
        ];
        foreach ($roles as $name => $permNames) {
            $role = Role::firstOrCreate(['name' => $name], ['label' => ucfirst(str_replace('_',' ',$name))]);
            $ids  = collect($permNames)->map(fn($n) => $created[$n]?->id)->filter()->all();
            $role->permissions()->sync($ids);
        }
    }
}
