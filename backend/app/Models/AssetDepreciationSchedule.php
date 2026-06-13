<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetDepreciationSchedule extends Model
{
    protected $table = 'asset_depreciation_schedule';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['asset_id', 'office_id', 'period_month', 'opening_book_value', 'depreciation_amount', 'accumulated_depreciation', 'closing_book_value', 'status', 'journal_entry_id', 'posted_at', 'posted_by'];
}
