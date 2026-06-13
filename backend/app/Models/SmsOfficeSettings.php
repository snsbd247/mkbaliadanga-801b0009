<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsOfficeSettings extends Model
{
    protected \$table = 'sms_office_settings';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'enabled', 'sender_id'];
}
