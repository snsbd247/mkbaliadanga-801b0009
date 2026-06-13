<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandHistory extends Model
{
    protected \$table = 'land_history';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'land_id', 'farmer_id', 'fiscal_year', 'season', 'mouza', 'dag_no', 'land_size', 'owner_type', 'field_type', 'cultivator_farmer_id', 'remarks', 'recorded_by', 'crop', 'yield_amount', 'yield_unit'];
}
