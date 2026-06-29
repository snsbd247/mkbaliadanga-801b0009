<?php

namespace App\Console\Commands;

use App\Support\CanonicalAdmins;
use App\Support\SanctumTokenSchema;
use Illuminate\Console\Command;

class VerifyAdmins extends Command
{
    protected $signature = 'admin:verify {--fix : Repair any missing accounts or roles}';

    protected $description = 'Verify the two required admin accounts (developer + super_admin) and optionally fix them';

    public function handle(): int
    {
        if ($this->option('fix')) {
            $tokenSchemaActions = SanctumTokenSchema::ensureUuidTokenableId();
            foreach ($tokenSchemaActions as $a) {
                $this->warn('• '.$a);
            }

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
            ['Username', 'Expected role', 'Exists', 'Active', 'Has role', 'Token', 'OK'],
            array_map(static fn ($s) => [
                $s['username'],
                $s['expected_role'],
                $s['exists'] ? 'yes' : 'NO',
                $s['active'] ? 'yes' : 'NO',
                $s['has_role'] ? 'yes' : 'NO',
                $s['token_ok'] ? 'yes' : 'NO',
                $s['ok'] ? '✓' : '✗',
            ], $status),
        );

        foreach ($status as $row) {
            if (! $row['token_ok'] && ! empty($row['token_error'])) {
                $this->warn("• {$row['username']} token probe failed: {$row['token_error']}");
            }
        }

        $allOk = ! in_array(false, array_column($status, 'ok'), true);

        if ($allOk) {
            $this->info('✓ All required admin accounts are present with correct roles.');

            return self::SUCCESS;
        }

        $this->error('✗ One or more admin accounts are missing or misconfigured. Run: php artisan admin:verify --fix');

        return self::FAILURE;
    }
}
