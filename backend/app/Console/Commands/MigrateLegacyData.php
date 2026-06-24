<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Copies legacy Supabase/PostgreSQL rows into the new MySQL schema.
 *
 * Strategy: for each (source → target) table pair we read every source row,
 * keep the columns that exist on the MySQL target (UUID `id` preserved), and
 * fold any leftover source columns into the target's `extra` JSON column when
 * it has one. Run order respects foreign keys.
 *
 *   php artisan migrate:legacy            # all tables
 *   php artisan migrate:legacy --only=farmers,lands
 *   php artisan migrate:legacy --truncate # wipe targets first
 */
class MigrateLegacyData extends Command
{
    protected $signature = 'migrate:legacy {--only=} {--truncate} {--chunk=500}';

    protected $description = 'Import legacy Supabase data into the MySQL backend.';

    /** Source pg table → target mysql table, in FK-safe order. */
    private array $map = [
        'offices' => 'offices',
        'divisions' => 'divisions',
        'districts' => 'districts',
        'upazilas' => 'upazilas',
        'unions' => 'unions',
        'mouzas' => 'mouzas',
        'patwaris' => 'patwaris',
        'land_types' => 'land_types',
        'farmers' => 'farmers',
        'farmer_notes' => 'farmer_notes',
        'lands' => 'lands',
        'seasons' => 'seasons',
        'irrigation_categories' => 'irrigation_categories',
        'irrigation_rates' => 'irrigation_rates',
        'irrigation_invoices' => 'irrigation_invoices',
        'irrigation_invoice_payments' => 'irrigation_invoice_payments',
        'savings_transactions' => 'savings_transactions',
        'loan_plans' => 'loan_plans',
        'loans' => 'loans',
        'loan_payments' => 'loan_repayments',
        'accounts' => 'accounts',
        'journal_entries' => 'journal_entries',
        'journal_entry_lines' => 'journal_lines',
        'assets' => 'assets',
        'payments' => 'payments',
        'payment_allocations' => 'payment_allocations',
        'sms_logs' => 'sms_logs',
        'qr_tokens' => 'qr_tokens',
    ];

    public function handle(): int
    {
        $only = array_filter(array_map('trim', explode(',', (string) $this->option('only'))));
        $chunk = (int) $this->option('chunk');

        try {
            DB::connection('pgsql_legacy')->getPdo();
        } catch (\Throwable $e) {
            $this->error('Legacy PG connection failed. Set PG_* in .env. ' . $e->getMessage());
            return self::FAILURE;
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        foreach ($this->map as $source => $target) {
            if ($only && ! in_array($target, $only, true) && ! in_array($source, $only, true)) {
                continue;
            }
            if (! Schema::connection('pgsql_legacy')->hasTable($source)) {
                $this->warn("skip {$source} → {$target} (source missing)");
                continue;
            }
            if (! Schema::hasTable($target)) {
                $this->warn("skip {$source} → {$target} (target missing)");
                continue;
            }

            if ($this->option('truncate')) {
                DB::table($target)->truncate();
            }

            $targetCols = Schema::getColumnListing($target);
            $hasExtra = in_array('extra', $targetCols, true);
            $count = 0;

            DB::connection('pgsql_legacy')->table($source)->orderBy('id')
                ->chunk($chunk, function ($rows) use ($target, $targetCols, $hasExtra, &$count) {
                    $batch = [];
                    foreach ($rows as $row) {
                        $src = (array) $row;
                        $mapped = [];
                        $extra = [];
                        foreach ($src as $col => $val) {
                            if (in_array($col, $targetCols, true) && $col !== 'extra') {
                                $mapped[$col] = $this->normalize($val);
                            } elseif ($col !== 'extra') {
                                $extra[$col] = $val;
                            }
                        }
                        if ($hasExtra) {
                            $existing = isset($src['extra']) ? (array) json_decode((string) $src['extra'], true) : [];
                            $mapped['extra'] = json_encode(array_merge($existing, $extra));
                        }
                        $batch[] = $mapped;
                    }
                    if ($batch) {
                        DB::table($target)->upsert($batch, ['id']);
                        $count += count($batch);
                    }
                });

            $this->info("ok   {$source} → {$target} ({$count} rows)");
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $this->info('Legacy data migration complete.');

        return self::SUCCESS;
    }

    /** Coerce pg booleans/objects into MySQL-friendly scalars. */
    private function normalize(mixed $val): mixed
    {
        if (is_bool($val)) {
            return $val ? 1 : 0;
        }
        if (is_array($val) || is_object($val)) {
            return json_encode($val);
        }
        return $val;
    }
}
