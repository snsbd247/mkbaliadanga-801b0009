<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('farmer_deletion_logs')) {
            return;
        }

        Schema::create('farmer_deletion_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('farmer_id')->nullable();
            $table->string('farmer_name')->nullable();
            $table->string('farmer_code')->nullable();
            $table->uuid('office_id')->nullable();
            $table->uuid('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('status'); // 'deleted' | 'blocked'
            $table->json('blocking')->nullable(); // { table: count }
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index('farmer_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_deletion_logs');
    }
};
