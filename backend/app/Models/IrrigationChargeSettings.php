<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationChargeSettings extends Model
{
    protected \$table = 'irrigation_charge_settings';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'delay_fee_percent', 'maintenance_percent', 'canal_percent', 'grace_days', 'auto_apply_delay_fee', 'created_by', 'updated_by'];
}
