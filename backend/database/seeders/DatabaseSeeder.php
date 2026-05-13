<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        $this->call([
            RolesPermissionsSeeder::class,
            DemoOfficeSeeder::class,
            AdminUserSeeder::class,
            ChartOfAccountsSeeder::class,
        ]);
    }
}
