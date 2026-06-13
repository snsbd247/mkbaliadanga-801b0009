<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetAlerts extends Model
{
    protected \$table = 'asset_alerts';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'location_id', 'alert_type', 'severity', 'message_en', 'message_bn', 'details', 'status', 'sms_sent_count', 'last_sms_at', 'acknowledged_by', 'acknowledged_at', 'resolved_at'];
}
