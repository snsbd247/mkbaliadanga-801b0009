<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationRateAuditLogs extends Model
{
    protected \$table = 'irrigation_rate_audit_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'irrigation_season_id', 'land_type_id', 'old_rate', 'new_rate', 'change_reason', 'changed_by', 'changed_at', 'ip', 'action'];
}
