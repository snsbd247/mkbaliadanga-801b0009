<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PermissionAuditLogs extends Model
{
    protected \$table = 'permission_audit_logs';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['changed_by', 'role', 'target_user_id', 'module', 'action', 'old_value', 'new_value', 'reason'];
}
