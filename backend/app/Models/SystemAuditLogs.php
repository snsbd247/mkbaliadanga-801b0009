<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemAuditLogs extends Model
{
    protected $table = 'system_audit_logs';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['office_id', 'user_id', 'module', 'action_type', 'reference_id', 'old_data', 'new_data', 'ip', 'user_agent'];
}
