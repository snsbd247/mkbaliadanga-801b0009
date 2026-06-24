<?php

namespace Database\Seeders;

use App\Models\Office;
use App\Models\RolePermission;
use App\Models\User;
use App\Models\UserRole;
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

        UserRole::query()->firstOrCreate([
            'user_id' => $admin->id,
            'role' => 'super_admin',
        ]);

        // super_admin gets the wildcard permission.
        RolePermission::query()->firstOrCreate([
            'role' => 'super_admin',
            'permission' => '*',
        ]);
    }
}
