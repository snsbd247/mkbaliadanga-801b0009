<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('asset_categories', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('depreciation_method', 16)->default('straight_line');
            $t->decimal('default_life_years', 5, 2)->default(5);
            $t->timestamps();
        });

        Schema::create('assets', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->constrained('offices')->cascadeOnDelete();
            $t->foreignUuid('category_id')->nullable()->constrained('asset_categories')->nullOnDelete();
            $t->string('code', 32)->unique();
            $t->string('name');
            $t->date('acquired_on');
            $t->decimal('cost', 14, 2);
            $t->decimal('salvage', 14, 2)->default(0);
            $t->decimal('life_years', 5, 2)->default(5);
            $t->decimal('accumulated_depreciation', 14, 2)->default(0);
            $t->string('status', 16)->default('active'); // active, disposed, written_off
            $t->jsonb('meta')->default('{}');
            $t->timestamps();
            $t->softDeletes();
        });

        Schema::create('asset_depreciation_runs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('asset_id')->constrained('assets')->cascadeOnDelete();
            $t->date('period_start');
            $t->date('period_end');
            $t->decimal('amount', 14, 2);
            $t->foreignUuid('journal_entry_id')->nullable()->constrained('journal_entries');
            $t->timestamps();
        });

        Schema::create('sms_logs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $t->foreignUuid('farmer_id')->nullable()->constrained('farmers')->nullOnDelete();
            $t->string('mobile', 32);
            $t->text('message');
            $t->string('status', 16)->default('queued'); // queued, sent, failed
            $t->string('event_type', 32)->nullable();
            $t->text('provider_response')->nullable();
            $t->integer('retry_count')->default(0);
            $t->timestamp('sent_at')->nullable();
            $t->foreignUuid('created_by')->nullable()->constrained('users');
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });

        Schema::create('sms_settings', function (Blueprint $t) {
            $t->id();
            $t->string('provider', 32)->default('greenweb');
            $t->string('sender_id')->nullable();
            $t->jsonb('config')->default('{}');
            $t->timestamps();
        });

        Schema::create('qr_tokens', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('farmer_id')->constrained('farmers')->cascadeOnDelete();
            $t->string('token', 128)->unique();
            $t->string('purpose', 32)->default('card');     // card, payment, verify
            $t->timestamp('issued_at');
            $t->timestamp('expires_at')->nullable();
            $t->timestamp('revoked_at')->nullable();
            $t->jsonb('meta')->default('{}');
            $t->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $t->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 64);
            $t->string('entity', 64);
            $t->uuid('entity_id')->nullable();
            $t->jsonb('meta')->default('{}');
            $t->string('ip', 64)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['entity', 'entity_id']);
            $t->index(['action', 'created_at']);
        });

        Schema::create('notifications', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('kind', 32);
            $t->string('title');
            $t->text('body')->nullable();
            $t->string('link')->nullable();
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'read_at']);
        });

        // Queue / job tables
        Schema::create('jobs', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('queue')->index();
            $t->longText('payload');
            $t->unsignedTinyInteger('attempts');
            $t->unsignedInteger('reserved_at')->nullable();
            $t->unsignedInteger('available_at');
            $t->unsignedInteger('created_at');
        });

        Schema::create('job_batches', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->string('name');
            $t->integer('total_jobs');
            $t->integer('pending_jobs');
            $t->integer('failed_jobs');
            $t->longText('failed_job_ids');
            $t->mediumText('options')->nullable();
            $t->integer('cancelled_at')->nullable();
            $t->integer('created_at');
            $t->integer('finished_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $t) {
            $t->id();
            $t->string('uuid')->unique();
            $t->text('connection');
            $t->text('queue');
            $t->longText('payload');
            $t->longText('exception');
            $t->timestamp('failed_at')->useCurrent();
        });

        Schema::create('cache', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->mediumText('value');
            $t->integer('expiration');
        });
        Schema::create('cache_locks', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->string('owner');
            $t->integer('expiration');
        });
    }
    public function down(): void {
        foreach (['cache_locks','cache','failed_jobs','job_batches','jobs','notifications','audit_logs','qr_tokens','sms_settings','sms_logs','asset_depreciation_runs','assets','asset_categories'] as $tbl) {
            Schema::dropIfExists($tbl);
        }
    }
};
