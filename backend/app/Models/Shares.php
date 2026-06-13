<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shares extends Model
{
    protected \$table = 'shares';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'balance', 'office_id'];
}
