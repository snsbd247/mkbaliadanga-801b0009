<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetPurchases extends Model
{
    protected \$table = 'asset_purchases';
    public \$incrementing = false;
    protected \$keyType = 'string';
    public \$timestamps = true;
    protected \$guarded = [];
    protected \$fillable = ['office_id', 'asset_id', 'purchase_date', 'quantity', 'unit_price', 'total_amount', 'supplier', 'invoice_no', 'payment_method', 'journal_entry_id', 'notes', 'created_by', 'deleted_at'];
}
