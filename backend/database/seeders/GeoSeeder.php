<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds Bangladesh administrative geo data.
 *
 * Source: ships a JSON tree at database/data/bd-geo.json
 *   { "divisions": [{ "name_en","name_bn","districts": [
 *       { "name_en","name_bn","upazilas": [
 *         { "name_en","name_bn","mouzas": [{ "name_en","name_bn" }] }
 *       ]}
 *   ]}]}
 *
 * Idempotent — uses updateOrInsert keyed on (parent_id, name_en) so re-runs
 * don't duplicate rows. Pass --with-mouzas to seed the full mouza set
 * (large); by default mouzas are seeded only when the table is empty.
 */
class GeoSeeder extends Seeder {
    public function run(): void {
        $file = database_path('data/bd-geo.json');
        if (!is_file($file)) {
            $this->command?->warn("GeoSeeder: $file not found — skipping.");
            return;
        }
        $tree = json_decode(file_get_contents($file), true);
        $withMouzas = (bool) env('SEED_MOUZAS', DB::table('mouzas')->count() === 0);

        foreach (($tree['divisions'] ?? []) as $div) {
            $divId = $this->upsert('divisions', null, $div);
            foreach (($div['districts'] ?? []) as $dist) {
                $distId = $this->upsert('districts', ['division_id' => $divId], $dist);
                foreach (($dist['upazilas'] ?? []) as $upa) {
                    $upaId = $this->upsert('upazilas', ['district_id' => $distId], $upa);
                    if (!$withMouzas) continue;
                    foreach (($upa['mouzas'] ?? []) as $mou) {
                        $this->upsert('mouzas', ['upazila_id' => $upaId], $mou);
                    }
                }
            }
        }
    }

    private function upsert(string $table, ?array $parent, array $row): string {
        $key = ($parent ?? []) + ['name' => $row['name_en']];
        $vals = $key + [
            'name_bn'    => $row['name_bn'] ?? null,
            'is_active'  => true,
            'updated_at' => now(),
        ];
        DB::table($table)->updateOrInsert($key, $vals + ['created_at' => now()]);
        return DB::table($table)->where($key)->value('id');
    }
}
