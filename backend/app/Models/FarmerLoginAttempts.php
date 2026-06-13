<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerLoginAttempts extends Model
{
    protected \$table = 'farmer_login_attempts';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['identifier', 'farmer_id', 'office_id', 'success', 'error_reason', 'ip', 'user_agent'];
}
