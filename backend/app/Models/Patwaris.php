<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patwaris extends Model
{
    protected \$table = 'patwaris';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['name', 'name_bn', 'mobile', 'nid', 'address', 'mouza_id', 'office_id', 'is_active', 'note', 'created_by'];
}
