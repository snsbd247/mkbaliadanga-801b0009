<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetDisposals extends Model
{
    protected \$table = 'asset_disposals';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = false;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'disposal_date', 'method', 'sale_amount', 'book_value', 'gain_loss', 'journal_entry_id', 'remarks', 'created_by', 'deleted_at'];
}
