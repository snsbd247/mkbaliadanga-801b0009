<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the default Irrigation Payment categories.
 *
 * Mirrors the enum used by the frontend (Irrigation Payment dialog) and
 * by supabase/functions/demo-reset (CATS = general/hawlat/bank/donation/misc).
 * Adds "mobile_banking" introduced in the May 2026 release.
 */
class IrrigationCategorySeeder extends Seeder {
    public function run(): void {
        $rows = [
            ['code' => 'general',        'label_en' => 'General',        'label_bn' => 'সাধারণ'],
            ['code' => 'hawlat',         'label_en' => 'Hawlat',         'label_bn' => 'হাওলাত'],
            ['code' => 'bank',           'label_en' => 'Bank',           'label_bn' => 'ব্যাংক'],
            ['code' => 'mobile_banking', 'label_en' => 'Mobile Banking', 'label_bn' => 'মোবাইল ব্যাংকিং'],
            ['code' => 'donation',       'label_en' => 'Donation',       'label_bn' => 'অনুদান'],
            ['code' => 'misc',           'label_en' => 'Misc',           'label_bn' => 'বিবিধ'],
        ];
        foreach ($rows as $r) {
            DB::table('irrigation_payment_categories')->updateOrInsert(
                ['code' => $r['code']],
                $r + ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
