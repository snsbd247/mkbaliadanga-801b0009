<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetScanLogs extends Model
{
    protected $table = 'asset_scan_logs';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['scanned_at', 'scanned_by', 'office_id', 'scanned_text', 'asset_id', 'asset_code', 'success', 'error_message', 'source'];
}
