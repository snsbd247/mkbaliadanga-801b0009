<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetStocks extends Model
{
    protected \$table = 'asset_stocks';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'location_id', 'quantity'];
}
