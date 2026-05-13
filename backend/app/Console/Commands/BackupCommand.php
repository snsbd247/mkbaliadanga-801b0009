<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackupCommand extends Command {
    protected $signature = 'mkb:backup';
    protected $description = 'Dump postgres + push to MinIO bucket /backups.';

    public function handle(): int {
        $stamp = now()->format('Ymd_His');
        $file  = "/tmp/mkb_backup_$stamp.sql.gz";
        $cmd = sprintf(
            'PGPASSWORD=%s pg_dump -h %s -U %s %s | gzip -9 > %s',
            escapeshellarg(env('DB_PASSWORD')),
            escapeshellarg(env('DB_HOST')),
            escapeshellarg(env('DB_USERNAME')),
            escapeshellarg(env('DB_DATABASE')),
            escapeshellarg($file),
        );
        exec($cmd, $out, $code);
        if ($code !== 0) { $this->error('pg_dump failed'); return self::FAILURE; }
        Storage::disk('s3')->put('backups/'.basename($file), file_get_contents($file));
        @unlink($file);
        $this->info("Uploaded backup: $stamp");
        return self::SUCCESS;
    }
}
