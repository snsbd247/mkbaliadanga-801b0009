<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Roles are stored in dedicated tables — never on users/profiles.
        Schema::create('roles', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name', 64)->unique();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('key', 128)->unique();
            $table->string('module', 64)->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
            $table->index('module');
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('role_id', 36);
            $table->char('permission_id', 36);
            $table->timestamps();

            $table->unique(['role_id', 'permission_id']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36);
            $table->char('role_id', 36);
            $table->timestamps();

            $table->unique(['user_id', 'role_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36)->nullable();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->char('entity_id', 36)->nullable();
            $table->char('office_id', 36)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['entity_type', 'entity_id']);
            $table->index('user_id');
            $table->index('office_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
