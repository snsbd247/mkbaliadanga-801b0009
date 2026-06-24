<?php

namespace Database\Seeders;

use App\Models\Office;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        // Head office.
        $office = Office::query()->firstOrCreate(
            ['code' => 'HO'],
            ['id' => (string) Str::uuid(), 'name' => 'প্রধান কার্যালয়', 'is_active' => true],
        );

        // Wildcard permission + super_admin role.
        $wildcard = Permission::query()->firstOrCreate(
            ['key' => '*'],
            ['id' => (string) Str::uuid(), 'module' => 'system', 'description' => 'All permissions'],
        );

        $role = Role::query()->firstOrCreate(
            ['name' => 'super_admin'],
            ['id' => (string) Str::uuid(), 'description' => 'Super Administrator'],
        );

        $role->permissions()->syncWithoutDetaching([$wildcard->id]);

        // Super admin account (ismail162 / Admin@123).
        $admin = User::query()->updateOrCreate(
            ['username' => 'ismail162'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Super Admin',
                'email' => 'ismail162@mohammadkhani.com',
                'password' => Hash::make('Admin@123'),
                'office_id' => $office->id,
                'is_active' => true,
            ],
        );

        $admin->roles()->syncWithoutDetaching([$role->id]);
    }
}
