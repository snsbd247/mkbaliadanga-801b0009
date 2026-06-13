<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandRelations extends Model
{
    protected \$table = 'land_relations';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['land_id', 'owner_farmer_id', 'sharecropper_farmer_id', 'share_percentage', 'valid_from', 'valid_to', 'note', 'office_id', 'created_by', 'deleted_at', 'area_decimal'];
}
