<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SmsLog extends Model {
    use HasUuids;
    protected $fillable = ['office_id','farmer_id','mobile','message','status','event_type','provider_response','retry_count','sent_at','created_by'];
    protected $casts = ['sent_at' => 'datetime'];
}
