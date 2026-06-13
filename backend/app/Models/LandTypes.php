<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandTypes extends Model
{
    protected $table = 'land_types';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['code', 'name', 'name_bn', 'is_active', 'sort_order', 'office_id', 'created_by', 'name_en', 'deleted_at'];
}
