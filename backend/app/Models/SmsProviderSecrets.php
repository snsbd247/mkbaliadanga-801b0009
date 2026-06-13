<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsProviderSecrets extends Model
{
    protected \$table = 'sms_provider_secrets';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['provider', 'api_token', 'updated_by', 'status', 'expires_at', 'activated_at', 'label', 'priority', 'dlr_url'];
}
