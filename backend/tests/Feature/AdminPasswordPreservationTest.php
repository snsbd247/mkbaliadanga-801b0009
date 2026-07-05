<?php

namespace Tests\Feature;

use App\Support\CanonicalAdmins;
use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Guards the "update.sh must never change an admin's password" contract.
 *
 * update.sh re-runs SuperAdminSeeder + `admin:verify --fix`
 * (CanonicalAdmins::fix) on every deploy. Both must be idempotent and MUST
 * preserve a password an admin has changed.
 */
class AdminPasswordPreservationTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_admins_with_configured_default_password(): void
    {
        config(['admin.default_password' => 'FirstBoot@123']);

        (new SuperAdminSeeder())->run();

        $dev = User::where('username', 'ismail162')->first();
        $this->assertNotNull($dev);
        $this->assertTrue(Hash::check('FirstBoot@123', $dev->password));
    }

    public function test_update_run_preserves_changed_admin_password(): void
    {
        // First boot creates the accounts with the default password.
        (new SuperAdminSeeder())->run();

        // Admin changes their password after go-live.
        $dev = User::where('username', 'ismail162')->firstOrFail();
        $dev->update(['password' => Hash::make('MyStrongPass!42')]);

        // Simulate a subsequent `bash scripts/update.sh` deploy:
        // re-seed + admin auto-repair run again.
        (new SuperAdminSeeder())->run();
        CanonicalAdmins::fix();

        $dev->refresh();

        // The changed password must survive; the default must NOT be restored.
        $this->assertTrue(Hash::check('MyStrongPass!42', $dev->password), 'Changed password was overwritten by update.');
        $this->assertFalse(Hash::check('Admin@123', $dev->password), 'Default password was wrongly restored.');
    }

    public function test_fix_still_repairs_missing_role_without_touching_password(): void
    {
        (new SuperAdminSeeder())->run();

        $dev = User::where('username', 'ismail162')->firstOrFail();
        $dev->update(['password' => Hash::make('Kept@Password9')]);
        $dev->roles()->detach();

        CanonicalAdmins::fix();
        $dev->refresh();

        $this->assertContains('developer', $dev->roleNames());
        $this->assertTrue(Hash::check('Kept@Password9', $dev->password));
    }
}
