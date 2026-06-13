<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetMaintenanceLogs extends Model
{
    protected \$table = 'asset_maintenance_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'maintenance_date', 'vendor', 'cost', 'downtime_days', 'status', 'remarks', 'created_by', 'deleted_at'];
}
