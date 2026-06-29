<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Repairs the Sanctum token table for this app's UUID user IDs.
 *
 * Some VPS installs were created while `personal_access_tokens.tokenable_id`
 * still used Laravel's default BIGINT morph column. This app's users use UUIDs,
 * so login can authenticate successfully and then fail with a 500 while issuing
 * the API token. This helper makes the repair idempotent and safe to run from
 * migrations, setup/update verification, and login as a last-resort autofix.
 */
class SanctumTokenSchema
{
    /** @return array<int, string> */
    public static function ensureUuidTokenableId(): array
    {
        $actions = [];

        if (! Schema::hasTable('personal_access_tokens')) {
            Schema::create('personal_access_tokens', function (Blueprint $table) {
                $table->id();
                $table->string('tokenable_type');
                $table->char('tokenable_id', 36);
                $table->index(['tokenable_type', 'tokenable_id'], 'pat_tokenable_index');
                $table->string('name');
                $table->string('token', 64)->unique();
                $table->text('abilities')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->timestamps();
            });

            return ['Created personal_access_tokens table with UUID tokenable_id.'];
        }

        if (DB::getDriverName() !== 'mysql') {
            return $actions;
        }

        $column = DB::selectOne(
            "SELECT DATA_TYPE AS data_type, CHARACTER_MAXIMUM_LENGTH AS max_length
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?",
            ['personal_access_tokens', 'tokenable_id']
        );

        $type = strtolower((string) ($column->data_type ?? ''));
        $length = (int) ($column->max_length ?? 0);
        $needsAlter = ! in_array($type, ['char', 'varchar'], true) || $length < 36;

        if ($needsAlter) {
            self::dropTokenableIndexes();
            DB::statement('ALTER TABLE `personal_access_tokens` MODIFY `tokenable_id` CHAR(36) NOT NULL');
            $actions[] = 'Changed personal_access_tokens.tokenable_id to CHAR(36) for UUID users.';
        }

        if (! self::hasTokenableIndex()) {
            DB::statement('ALTER TABLE `personal_access_tokens` ADD INDEX `pat_tokenable_index` (`tokenable_type`, `tokenable_id`)');
            $actions[] = 'Added personal_access_tokens tokenable index.';
        }

        return $actions;
    }

    private static function hasTokenableIndex(): bool
    {
        $indexes = DB::select('SHOW INDEX FROM `personal_access_tokens`');
        $columnsByKey = [];

        foreach ($indexes as $idx) {
            $key = (string) ($idx->Key_name ?? '');
            $seq = (int) ($idx->Seq_in_index ?? 0);
            $column = (string) ($idx->Column_name ?? '');
            if ($key === '' || $key === 'PRIMARY') {
                continue;
            }
            $columnsByKey[$key][$seq] = $column;
        }

        foreach ($columnsByKey as $columns) {
            ksort($columns);
            $ordered = array_values($columns);
            if ($ordered === ['tokenable_type', 'tokenable_id']) {
                return true;
            }
        }

        return false;
    }

    private static function dropTokenableIndexes(): void
    {
        $indexes = DB::select('SHOW INDEX FROM `personal_access_tokens`');
        $keys = [];

        foreach ($indexes as $idx) {
            $key = (string) ($idx->Key_name ?? '');
            $column = (string) ($idx->Column_name ?? '');
            if ($key !== '' && $key !== 'PRIMARY' && in_array($column, ['tokenable_type', 'tokenable_id'], true)) {
                $keys[$key] = true;
            }
        }

        foreach (array_keys($keys) as $key) {
            DB::statement('ALTER TABLE `personal_access_tokens` DROP INDEX `'.$key.'`');
        }
    }
}