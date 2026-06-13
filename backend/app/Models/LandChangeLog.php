<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandChangeLog extends Model
{
    protected \$table = 'land_change_log';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['land_id', 'farmer_id', 'office_id', 'change_type', 'old_values', 'new_values', 'remarks', 'changed_by'];
}
