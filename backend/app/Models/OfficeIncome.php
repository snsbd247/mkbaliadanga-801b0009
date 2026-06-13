<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OfficeIncome extends Model {
    use HasUuids;
    protected $fillable = ['office_id','receipt_no','income_type','payer_name','amount','received_on','stream','note','created_by'];
    protected $casts = ['received_on'=>'date','amount'=>'decimal:2'];
}
