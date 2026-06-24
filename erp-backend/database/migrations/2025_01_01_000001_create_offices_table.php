<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('offices', function (Blueprint $t) {
            $t->char('id', 36)->primary();
            $t->string('name');
            $t->string('code', 32)->nullable()->unique();
            $t->string('address')->nullable();
            $t->string('phone', 32)->nullable();
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offices');
    }
};
