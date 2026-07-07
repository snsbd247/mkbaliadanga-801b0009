<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('receipt_settings')) {
            Schema::create('receipt_settings', function (Blueprint $table) {
                $table->integer('id')->default(1);
                $table->string('language', 1024)->default('en');
                $table->string('paper_size', 1024)->default('a5');
                $table->string('accent_color', 1024)->default('#1f4e79');
                $table->boolean('show_logo')->default(true);
                $table->boolean('show_signature_line')->default(true);
                $table->boolean('show_office')->default(true);
                $table->boolean('show_token_block')->default(true);
                $table->string('header_alignment', 1024)->default('center');
                $table->string('footer_note', 1024)->default('This is a system-generated receipt. Please retain for your records.');
                $table->string('footer_note_bn', 1024)->default('এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।');
                $table->boolean('show_watermark')->default(false);
                $table->string('watermark_text', 1024)->default('');
                $table->boolean('show_penalty_row')->default(true);
                $table->boolean('show_charge_row')->default(true);
                $table->string('qr_placement', 1024)->default('right');
                $table->bigInteger('receipt_serial_start')->default(0);
                $table->char('updated_by', 36)->nullable();
                $table->timestamp('updated_at')->nullable();
            });
        } else {
            Schema::table('receipt_settings', function (Blueprint $table) {
                if (! Schema::hasColumn('receipt_settings', 'receipt_serial_start')) {
                    $table->bigInteger('receipt_serial_start')->default(0);
                }
            });
        }

        $defaults = [
            'id' => 1,
            'language' => 'en',
            'paper_size' => 'a5',
            'accent_color' => '#1f4e79',
            'show_logo' => true,
            'show_signature_line' => true,
            'show_office' => true,
            'show_token_block' => true,
            'header_alignment' => 'center',
            'footer_note' => 'This is a system-generated receipt. Please retain for your records.',
            'footer_note_bn' => 'এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।',
            'show_watermark' => false,
            'watermark_text' => '',
            'show_penalty_row' => true,
            'show_charge_row' => true,
            'qr_placement' => 'right',
            'receipt_serial_start' => 0,
            'updated_at' => now(),
        ];
        $defaults = array_filter($defaults, fn ($value, $column) => Schema::hasColumn('receipt_settings', $column), ARRAY_FILTER_USE_BOTH);
        if (! DB::table('receipt_settings')->where('id', 1)->exists()) {
            DB::table('receipt_settings')->insert($defaults);
        }

        if (! Schema::hasTable('receipt_counters')) {
            Schema::create('receipt_counters', function (Blueprint $table) {
                $table->text('kind');
                $table->integer('year');
                $table->bigInteger('last_no')->default(0);
                $table->timestamp('updated_at')->nullable();
            });
        }

        if (! DB::table('receipt_counters')->where('kind', 'SERIAL')->where('year', 0)->exists()) {
            $counter = ['kind' => 'SERIAL', 'year' => 0, 'last_no' => 0, 'updated_at' => now()];
            $counter = array_filter($counter, fn ($value, $column) => Schema::hasColumn('receipt_counters', $column), ARRAY_FILTER_USE_BOTH);
            DB::table('receipt_counters')->insert($counter);
        }
    }

    public function down(): void
    {
        // Keep persisted receipt settings intact on rollback.
    }
};