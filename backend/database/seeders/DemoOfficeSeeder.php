<?php

namespace Database\Seeders;

use App\Models\Office;
use Illuminate\Database\Seeder;

class DemoOfficeSeeder extends Seeder {
    public function run(): void {
        Office::firstOrCreate(
            ['code' => 'MKB-HQ'],
            ['name' => 'MK Baliadanga HQ', 'name_bn' => 'এমকে বালিয়াডাঙ্গা সদর', 'is_active' => true]
        );
    }
}
