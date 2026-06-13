<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPermissions extends Model
{
    protected \$table = 'user_permissions';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['user_id', 'module', 'can_view', 'can_add', 'can_edit', 'can_delete'];
}
