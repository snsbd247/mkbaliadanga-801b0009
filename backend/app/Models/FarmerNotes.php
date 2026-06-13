<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FarmerNotes extends Model
{
    protected \$table = 'farmer_notes';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['farmer_id', 'note', 'pinned', 'created_by'];
}
