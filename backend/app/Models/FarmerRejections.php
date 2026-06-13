<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerRejections extends Model
{
    protected \$table = 'farmer_rejections';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['user_id', 'office_id', 'farmer_id', 'operation', 'failed_level', 'reason', 'attempted', 'error_message'];
}
