<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Resets every Postgres serial/identity sequence to MAX(id) + 1.
 *
 * Run after a one-time data import where rows were inserted with
 * explicit primary key values (e.g. migrated from Supabase).
 */
class SequenceFixSeeder extends Seeder
{
    public function run(): void
    {
        $tables = DB::select(
            "SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        );

        foreach ($tables as $row) {
            $table = $row->table_name;
            if (!Schema::hasColumn($table, 'id')) continue;

            $seq = DB::selectOne(
                "SELECT pg_get_serial_sequence(?, 'id') AS seq",
                [$table]
            );
            if (!$seq?->seq) continue;

            DB::statement(
                "SELECT setval(?, COALESCE((SELECT MAX(id) FROM \"$table\"), 0) + 1, false)",
                [$seq->seq]
            );
            $this->command->info("  ✔ $table → {$seq->seq}");
        }
    }
}
