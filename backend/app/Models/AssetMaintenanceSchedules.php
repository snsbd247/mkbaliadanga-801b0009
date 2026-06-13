<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetMaintenanceSchedules extends Model
{
    protected \$table = 'asset_maintenance_schedules';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'title', 'frequency_days', 'next_due_at', 'vendor', 'notes', 'active', 'last_generated_alert_at', 'created_by'];
}
