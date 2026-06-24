<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farmer_otps', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('mobile', 32);
            $table->string('otp_hash', 191);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();

            $table->index('mobile');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farmer_otps');
    }
};
