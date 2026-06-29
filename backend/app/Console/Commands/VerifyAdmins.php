<?php

namespace App\Console\Commands;

use App\Support\CanonicalAdmins;
use Illuminate\Console\Command;

class VerifyAdmins extends Command
{
    protected $signature = 'admin:verify {--fix : Repair any missing accounts or roles}';

    protected $description = 'Verify the two required admin accounts (developer + super_admin) and optionally fix them';

    public function handle(): int
    {
        if ($this->option('fix')) {
            $actions = CanonicalAdmins::fix();
            if (empty($actions)) {
                $this->info('✓ Nothing to fix — both admin accounts already correct.');
            } else {
                foreach ($actions as $a) {
                    $this->warn('• '.$a);
                }
            }
        }

        $status = CanonicalAdmins::status();

        $this->table(
            ['Username', 'Expected role', 'Exists', 'Active', 'Has role', 'OK'],
            array_map(static fn ($s) => [
                $s['username'],
                $s['expected_role'],
                $s['exists'] ? 'yes' : 'NO',
                $s['active'] ? 'yes' : 'NO',
                $s['has_role'] ? 'yes' : 'NO',
                $s['ok'] ? '✓' : '✗',
            ], $status),
        );

        $allOk = ! in_array(false, array_column($status, 'ok'), true);

        if ($allOk) {
            $this->info('✓ All required admin accounts are present with correct roles.');

            return self::SUCCESS;
        }

        $this->error('✗ One or more admin accounts are missing or misconfigured. Run: php artisan admin:verify --fix');

        return self::FAILURE;
    }
}
