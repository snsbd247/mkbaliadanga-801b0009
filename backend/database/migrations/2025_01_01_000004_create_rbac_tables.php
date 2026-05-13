<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('roles', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 64)->unique();      // super_admin, admin, manager, accountant, operator, developer, viewer
            $t->string('label')->nullable();
            $t->jsonb('meta')->default('{}');
            $t->timestamps();
        });

        Schema::create('permissions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 96)->unique();      // farmers.read, farmers.write, loans.approve, ...
            $t->string('group', 64)->index();
            $t->string('label')->nullable();
            $t->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $t) {
            $t->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $t->foreignUuid('permission_id')->constrained('permissions')->cascadeOnDelete();
            $t->primary(['role_id', 'permission_id']);
        });

        Schema::create('user_roles', function (Blueprint $t) {
            $t->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignUuid('role_id')->constrained('roles')->cascadeOnDelete();
            $t->foreignUuid('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
            $t->timestamps();
            $t->primary(['user_id', 'role_id', 'office_id']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
