<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('offices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('code', 32)->unique();
            $t->string('name');
            $t->string('name_bn')->nullable();
            $t->string('address')->nullable();
            $t->string('phone', 32)->nullable();
            $t->jsonb('settings')->default('{}');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();
        });
    }
    public function down(): void { Schema::dropIfExists('offices'); }
};
