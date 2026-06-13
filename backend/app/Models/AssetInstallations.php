<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetInstallations extends Model
{
    protected $table = 'asset_installations';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['office_id', 'asset_id', 'location_id', 'location_name', 'installed_by', 'install_date', 'condition_status', 'remarks', 'deleted_at'];
}
