<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Office;
use Illuminate\Database\Seeder;

class ChartOfAccountsSeeder extends Seeder {
    public function run(): void {
        $office = Office::where('code', 'MKB-HQ')->first();
        if (!$office) return;

        $rows = [
            ['1000','Cash on Hand','asset'],
            ['1010','Bank — Operating','asset'],
            ['1100','Accounts Receivable — Irrigation','asset'],
            ['1200','Loans Receivable','asset'],
            ['1500','Fixed Assets','asset'],
            ['1510','Accumulated Depreciation','asset'],
            ['2000','Member Savings','liability'],
            ['2100','Share Capital','equity'],
            ['3000','Retained Earnings','equity'],
            ['4000','Irrigation Income','income'],
            ['4100','Loan Interest Income','income'],
            ['4200','Delay Fee Income','income'],
            ['5000','Salaries','expense'],
            ['5100','Diesel & Power','expense'],
            ['5200','Repairs & Maintenance','expense'],
            ['5300','Office Expenses','expense'],
            ['5400','Depreciation Expense','expense'],
        ];
        foreach ($rows as [$code, $name, $type]) {
            Account::firstOrCreate(
                ['office_id' => $office->id, 'code' => $code],
                ['name' => $name, 'type' => $type, 'is_active' => true],
            );
        }
    }
}
