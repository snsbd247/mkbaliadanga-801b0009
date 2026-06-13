<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetDepreciationSettings extends Model
{
    protected \$table = 'asset_depreciation_settings';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['asset_id', 'office_id', 'method', 'useful_life_months', 'salvage_value', 'wdv_rate_pct', 'start_on', 'expense_account_code', 'accum_account_code', 'is_active', 'created_by'];
}
