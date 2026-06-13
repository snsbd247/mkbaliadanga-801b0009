<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetAuditLogs extends Model
{
    protected \$table = 'asset_audit_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'user_id', 'asset_id', 'entity', 'entity_id', 'action_type', 'old_data', 'new_data', 'remarks'];
}
