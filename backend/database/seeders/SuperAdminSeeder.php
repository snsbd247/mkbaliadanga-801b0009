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

        // Wildcard permission grants everything.
        $wildcard = Permission::query()->firstOrCreate(
            ['key' => '*'],
            ['id' => (string) Str::uuid(), 'module' => 'system', 'description' => 'All permissions'],
        );

        // Roles: developer (highest) + super_admin.
        $developerRole = Role::query()->firstOrCreate(
            ['name' => 'developer'],
            ['id' => (string) Str::uuid(), 'description' => 'Developer'],
        );
        $superAdminRole = Role::query()->firstOrCreate(
            ['name' => 'super_admin'],
            ['id' => (string) Str::uuid(), 'description' => 'Super Administrator'],
        );

        $developerRole->permissions()->syncWithoutDetaching([$wildcard->id]);
        $superAdminRole->permissions()->syncWithoutDetaching([$wildcard->id]);

        // Developer account (ismail162 / Admin@123).
        $developer = User::query()->updateOrCreate(
            ['username' => 'ismail162'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Developer',
                'email' => 'ismail162@mohammadkhani.com',
                'password' => Hash::make('Admin@123'),
                'office_id' => $office->id,
                'is_active' => true,
            ],
        );
        $developer->roles()->syncWithoutDetaching([$developerRole->id]);

        // Super admin account (suparadmin / Admin@123).
        $superAdmin = User::query()->updateOrCreate(
            ['username' => 'suparadmin'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Super Admin',
                'email' => 'suparadmin@mohammadkhani.com',
                'password' => Hash::make('Admin@123'),
                'office_id' => $office->id,
                'is_active' => true,
            ],
        );
        $superAdmin->roles()->syncWithoutDetaching([$superAdminRole->id]);
    }
}
