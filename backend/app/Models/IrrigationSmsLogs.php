<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IrrigationSmsLogs extends Model
{
    protected \$table = 'irrigation_sms_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'irrigation_invoice_id', 'farmer_id', 'mobile', 'sms_type', 'message', 'status', 'failure_reason', 'gateway_response', 'retry_count', 'sent_by', 'sent_at', 'delivered_at'];
}
