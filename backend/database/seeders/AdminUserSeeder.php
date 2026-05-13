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
        $email  = env('ADMIN_EMAIL', 'admin@mkb.local');
        $pass   = env('ADMIN_PASSWORD', 'ChangeMe!2025');
        $name   = env('ADMIN_NAME', 'System Admin');

        $user = User::firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => Hash::make($pass), 'office_id' => $office?->id, 'is_active' => true],
        );
        foreach (['super_admin','developer'] as $r) {
            $role = Role::where('name', $r)->first();
            if ($role && !$user->roles()->where('roles.id', $role->id)->exists()) {
                $user->roles()->attach($role->id, ['office_id' => $office?->id]);
            }
        }
        $this->command->info("Admin user ready: $email");
    }
}
