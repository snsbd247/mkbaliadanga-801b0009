<?php

namespace Database\Seeders;

use App\Models\CustomRole;
use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Default head office
        $office = Office::firstOrCreate(
            ['code' => 'HO'],
            ['id' => (string) Str::uuid(), 'name' => 'Head Office', 'is_active' => true]
        );

        $username = env('SUPERADMIN_USERNAME', 'ismail162');
        $email    = env('SUPERADMIN_EMAIL', 'admin@mohammadkhani.com');
        $password = env('SUPERADMIN_PASSWORD', 'Admin@123');
        $name     = env('SUPERADMIN_NAME', 'Super Admin');

        $user = User::firstOrCreate(
            ['username' => $username],
            [
                'id'        => (string) Str::uuid(),
                'name'      => $name,
                'email'     => $email,
                'password'  => Hash::make($password),
                'office_id' => $office->id,
                'is_active' => true,
            ]
        );

        $role = CustomRole::where('name', 'super_admin')->first();
        if ($role) {
            $user->roles()->syncWithoutDetaching([
                $role->id => ['office_id' => $office->id],
            ]);
        }

        $this->command?->info("Super admin ready → username: {$username}");
    }
}
