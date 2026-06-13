<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerOtps extends Model
{
    protected \$table = 'farmer_otps';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'otp_hash', 'mobile_masked', 'expires_at', 'attempts', 'used', 'ip'];
}
