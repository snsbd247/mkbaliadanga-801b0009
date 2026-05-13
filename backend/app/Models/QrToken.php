<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class QrToken extends Model {
    use HasUuids;
    protected $fillable = ['farmer_id','token','purpose','issued_at','expires_at','revoked_at','meta'];
    protected $casts = ['issued_at'=>'datetime','expires_at'=>'datetime','revoked_at'=>'datetime','meta'=>'array'];
}
