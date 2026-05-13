<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['office_id','farmer_id','receipt_no','paid_on','kind','amount','method','allocations','note','collected_by'];
    protected $casts = ['paid_on'=>'date','amount'=>'decimal:2','allocations'=>'array'];
    public function farmer() { return $this->belongsTo(Farmer::class); }
}
