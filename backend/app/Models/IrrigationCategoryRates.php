<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationCategoryRates extends Model
{
    protected \$table = 'irrigation_category_rates';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'irrigation_season_id', 'irrigation_category_id', 'rate_type', 'rate', 'unit', 'is_negotiable', 'created_by'];
}
