<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('office_id', 36)->nullable();
            $table->string('name', 191);
            $table->string('category', 128)->nullable();
            $table->string('serial_no', 128)->nullable();
            $table->date('purchase_date')->nullable();
            $table->decimal('cost', 16, 2)->nullable();
            $table->string('status', 64)->nullable();
            $table->json('extra')->nullable();
            $table->timestamps();

            $table->index('office_id');
            $table->foreign('office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
