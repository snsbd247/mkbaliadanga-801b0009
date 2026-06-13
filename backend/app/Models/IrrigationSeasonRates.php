<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationSeasonRates extends Model
{
    protected \$table = 'irrigation_season_rates';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['irrigation_season_id', 'land_type_id', 'rate_per_shotok', 'office_id', 'created_by'];
}
