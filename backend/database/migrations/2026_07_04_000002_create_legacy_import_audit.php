<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log for legacy irrigation imports.
 *
 * One row per import batch. Accumulates counts as chunked uploads land so a
 * partially-completed (interrupted) batch can be resumed with the same
 * batch_id and its current status displayed. Fully isolated from live modules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_import_audit', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('import_batch_id')->unique();
            $table->uuid('office_id')->nullable()->index();
            $table->uuid('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('inserted')->default(0);
            $table->unsignedInteger('skipped')->default(0);
            $table->unsignedInteger('blocked')->default(0);
            $table->string('status')->default('in_progress'); // in_progress | completed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_import_audit');
    }
};
