<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('to', 32);
            $table->text('body');
            $table->string('status', 24)->default('queued'); // queued|sent|failed
            $table->string('provider', 64)->nullable();
            $table->text('error')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamps();

            $table->index('office_id');
            $table->index('status');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('qr_tokens', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('subject_type', 64);
            $table->char('subject_id', 36);
            $table->string('token', 80)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamps();

            $table->index(['subject_type', 'subject_id']);
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_tokens');
        Schema::dropIfExists('sms_logs');
    }
};
