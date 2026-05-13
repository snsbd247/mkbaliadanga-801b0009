<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Land extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['office_id','farmer_id','dag_no','khatian_no','area_decimal','village_id','crop','meta'];
    protected $casts = ['meta' => 'array', 'area_decimal' => 'decimal:2'];
    public function farmer() { return $this->belongsTo(Farmer::class); }
}
