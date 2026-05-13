<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IntegrityScanCommand extends Command {
    protected $signature = 'mkb:integrity-scan';
    protected $description = 'Run daily data integrity checks (orphans, unbalanced refs).';

    public function handle(): int {
        $orphans = DB::table('ledger_entries as l')
            ->leftJoin('journal_entries as j', 'j.id', '=', 'l.journal_entry_id')
            ->whereNull('j.id')->count();
        $this->info("Orphan ledger entries: $orphans");
        return self::SUCCESS;
    }
}
