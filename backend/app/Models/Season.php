<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Season extends Model {
    use HasUuids;
    protected $fillable = ['office_id','name','name_bn','start_date','end_date','is_active','rates'];
    protected $casts = ['start_date'=>'date','end_date'=>'date','is_active'=>'boolean','rates'=>'array'];
}
