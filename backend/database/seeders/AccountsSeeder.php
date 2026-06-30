<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds the canonical chart of accounts (idempotent by `code`).
 * Includes the Discount Expense (5050) account used by the irrigation
 * discount journal-posting engine.
 */
class AccountsSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            ['code' => '1010', 'name' => 'Cash',                     'name_bn' => 'নগদ',                 'type' => 'asset',     'is_system' => true],
            ['code' => '1020', 'name' => 'Bank',                     'name_bn' => 'ব্যাংক',               'type' => 'asset',     'is_system' => true],
            ['code' => '1040', 'name' => 'Loans Receivable',         'name_bn' => 'প্রদত্ত ঋণ',           'type' => 'asset',     'is_system' => true],
            ['code' => '1600', 'name' => 'Fixed Assets',             'name_bn' => 'স্থায়ী সম্পদ',         'type' => 'asset',     'is_system' => false],
            ['code' => '1610', 'name' => 'Accumulated Depreciation', 'name_bn' => 'পুঞ্জীভূত অবচয়',      'type' => 'asset',     'is_system' => false],
            ['code' => '2010', 'name' => 'Savings Payable',          'name_bn' => 'সঞ্চয় পরিশোধযোগ্য',   'type' => 'liability', 'is_system' => true],
            ['code' => '3020', 'name' => 'Share Capital',            'name_bn' => 'শেয়ার মূলধন',          'type' => 'equity',    'is_system' => true],
            ['code' => '4010', 'name' => 'Irrigation Income',        'name_bn' => 'সেচ আয়',              'type' => 'income',    'is_system' => true],
            ['code' => '4020', 'name' => 'Loan Interest Income',     'name_bn' => 'ঋণ সুদ আয়',           'type' => 'income',    'is_system' => false],
            ['code' => '5010', 'name' => 'Maintenance',              'name_bn' => 'রক্ষণাবেক্ষণ',          'type' => 'expense',   'is_system' => true],
            ['code' => '5020', 'name' => 'Electricity',              'name_bn' => 'বিদ্যুৎ',               'type' => 'expense',   'is_system' => true],
            ['code' => '5030', 'name' => 'Salary',                   'name_bn' => 'বেতন',                 'type' => 'expense',   'is_system' => true],
            ['code' => '5040', 'name' => 'Repair',                   'name_bn' => 'মেরামত',               'type' => 'expense',   'is_system' => true],
            ['code' => '5050', 'name' => 'Discount Expense',         'name_bn' => 'ডিসকাউন্ট খরচ',        'type' => 'expense',   'is_system' => false],
            ['code' => '5090', 'name' => 'Other Expenses',           'name_bn' => 'অন্যান্য খরচ',          'type' => 'expense',   'is_system' => true],
            ['code' => '5410', 'name' => 'Depreciation Expense',     'name_bn' => 'অবচয় খরচ',            'type' => 'expense',   'is_system' => false],
        ];

        foreach ($accounts as $acc) {
            $exists = DB::table('accounts')->where('code', $acc['code'])->whereNull('office_id')->exists();
            if ($exists) {
                DB::table('accounts')->where('code', $acc['code'])->whereNull('office_id')->update([
                    'name'       => $acc['name'],
                    'name_bn'    => $acc['name_bn'],
                    'type'       => $acc['type'],
                    'is_system'  => $acc['is_system'],
                    'updated_at' => now(),
                ]);
                continue;
            }
            DB::table('accounts')->insert([
                'id'         => (string) Str::uuid(),
                'office_id'  => null,
                'code'       => $acc['code'],
                'name'       => $acc['name'],
                'name_bn'    => $acc['name_bn'],
                'type'       => $acc['type'],
                'parent_id'  => null,
                'is_system'  => $acc['is_system'],
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
