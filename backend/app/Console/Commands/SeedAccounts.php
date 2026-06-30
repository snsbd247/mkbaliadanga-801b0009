<?php

namespace App\Console\Commands;

use Database\Seeders\AccountsSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Safely (re-)runs the chart-of-accounts seeder in any environment, including
 * production. The AccountsSeeder is idempotent (upsert by `code`), so this only
 * inserts missing accounts and refreshes labels — it never deletes data.
 */
class SeedAccounts extends Command
{
    protected $signature = 'accounts:seed {--force : Skip the interactive confirmation in production}';

    protected $description = 'Re-run the chart-of-accounts seeder safely (idempotent) in production environments';

    public function handle(): int
    {
        if (app()->environment('production') && ! $this->option('force')) {
            if (! $this->confirm('Run AccountsSeeder in production? It is idempotent and will not delete data.')) {
                $this->warn('Aborted.');

                return self::SUCCESS;
            }
        }

        $before = DB::table('accounts')->count();
        $this->call(AccountsSeeder::class);
        $after = DB::table('accounts')->count();

        $this->info(sprintf('✓ Chart of accounts seeded. Accounts: %d → %d (%d added).', $before, $after, max(0, $after - $before)));

        // Verify the critical system accounts the posting engine depends on.
        $required = ['1010' => 'Cash', '4010' => 'Irrigation Income', '5050' => 'Discount Expense'];
        $missing = [];
        foreach ($required as $code => $name) {
            if (! DB::table('accounts')->where('code', $code)->exists()) {
                $missing[] = "$code ($name)";
            }
        }
        if ($missing) {
            $this->error('✗ Still missing required accounts: '.implode(', ', $missing));

            return self::FAILURE;
        }
        $this->info('✓ All required posting accounts present (1010, 4010, 5050).');

        return self::SUCCESS;
    }
}
