<?php

namespace Database\Seeders;

use App\Models\Office;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder {
    public function run(): void {
        $office = Office::where('code', 'MKB-HQ')->first();

        $accounts = [
            [
                'username' => 'ismail162',
                'email'    => env('DEV_EMAIL', 'ismail162@mkb.local'),
                'name'     => 'Ismail (Developer)',
                'password' => env('DEV_PASSWORD', '123456'),
                'roles'    => ['developer', 'super_admin'],
            ],
            [
                'username' => 'superadmin',
                'email'    => env('SUPERADMIN_EMAIL', 'superadmin@mkb.local'),
                'name'     => 'Super Admin',
                'password' => env('SUPERADMIN_PASSWORD', 'Admin@123456'),
                'roles'    => ['super_admin'],
            ],
        ];

        foreach ($accounts as $a) {
            $user = User::where('username', $a['username'])->orWhere('email', $a['email'])->first();
            if (!$user) {
                $user = new User();
                $user->id = (string) \Illuminate\Support\Str::uuid();
            }
            $user->forceFill([
                'username'  => $a['username'],
                'email'     => $a['email'],
                'name'      => $a['name'],
                'password'  => Hash::make($a['password']),
                'office_id' => $office?->id,
                'is_active' => true,
            ])->save();

            foreach ($a['roles'] as $r) {
                $role = Role::where('name', $r)->first();
                if ($role && !$user->roles()->where('roles.id', $role->id)->exists()) {
                    $user->roles()->attach($role->id, ['office_id' => $office?->id]);
                }
            }
            $this->command->info("Admin user ready: {$a['username']}");
        }
    }
}
