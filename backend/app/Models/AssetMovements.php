<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetMovements extends Model
{
    protected $table = 'asset_movements';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['office_id', 'asset_id', 'from_location_id', 'to_location_id', 'quantity', 'moved_by', 'movement_date', 'remarks', 'deleted_at', 'approval_status', 'requested_by', 'approved_by', 'approved_at', 'rejection_reason', 'applied'];
}
