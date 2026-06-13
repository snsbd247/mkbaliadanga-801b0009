<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandTransfers extends Model
{
    protected \$table = 'land_transfers';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['source_land_id', 'source_farmer_id', 'transfer_type', 'remark', 'office_id', 'transferred_at', 'created_by', 'source_dag_no', 'source_mouza', 'source_land_size', 'source_owner_name', 'source_owner_code'];
}
