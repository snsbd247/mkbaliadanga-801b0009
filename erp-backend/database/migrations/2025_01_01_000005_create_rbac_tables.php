<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('custom_roles', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->string('name', 64)->unique();   // super_admin, admin, manager, accountant, operator, developer, viewer
            $t->string('label')->nullable();
            $t->json('meta')->nullable();
            $t->timestamps();
        });

        Schema::create('permissions', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->string('name', 96)->unique();   // farmers.view, loans.approve, ...
            $t->string('group', 64)->index();
            $t->string('label')->nullable();
            $t->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $t) {
            $t->char('role_id', 36);
            $t->char('permission_id', 36);
            $t->primary(['role_id', 'permission_id']);
            $t->foreign('role_id')->references('id')->on('custom_roles')->cascadeOnDelete();
            $t->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });

        // Roles assigned to users — ALWAYS in its own table (never on users/profiles).
        Schema::create('user_custom_roles', function (Blueprint $t) {
            $t->char('user_id', 36);
            $t->char('role_id', 36);
            $t->char('office_id', 36)->nullable();
            $t->timestamps();
            $t->primary(['user_id', 'role_id'], 'user_custom_roles_pk');
            $t->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $t->foreign('role_id')->references('id')->on('custom_roles')->cascadeOnDelete();
            $t->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_custom_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('custom_roles');
    }
};
