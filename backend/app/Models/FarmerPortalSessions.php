<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerPortalSessions extends Model
{
    protected \$table = 'farmer_portal_sessions';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'token_hash', 'expires_at', 'last_used_at', 'ip', 'user_agent'];
}
