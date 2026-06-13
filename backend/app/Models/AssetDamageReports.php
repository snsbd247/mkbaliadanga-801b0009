<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetDamageReports extends Model
{
    protected \$table = 'asset_damage_reports';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'report_date', 'severity', 'reported_by', 'status', 'remarks', 'deleted_at'];
}
