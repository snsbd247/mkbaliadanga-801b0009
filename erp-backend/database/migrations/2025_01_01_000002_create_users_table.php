<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->string('name');
            $t->string('email')->unique();
            $t->string('username', 64)->nullable()->unique();
            $t->timestamp('email_verified_at')->nullable();
            $t->string('password');
            $t->char('office_id', 36)->nullable();
            $t->string('phone', 32)->nullable();
            $t->json('preferences')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamp('last_login_at')->nullable();
            $t->string('last_login_ip', 64)->nullable();
            $t->rememberToken();
            $t->timestamps();
            $t->softDeletes();

            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('password_reset_tokens', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->char('user_id', 36)->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
