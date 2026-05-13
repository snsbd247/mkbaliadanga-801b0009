<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Asset extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['office_id','category_id','code','name','acquired_on','cost','salvage','life_years','accumulated_depreciation','status','meta'];
    protected $casts = ['acquired_on' => 'date', 'meta' => 'array'];
}
