<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FarmerCredential extends Model {
    use HasUuids;
    protected $fillable = ['farmer_id','password_hash','otp_code','otp_expires_at','otp_attempts','last_login_at'];
    protected $casts = ['otp_expires_at' => 'datetime','last_login_at' => 'datetime'];
    protected $hidden = ['password_hash','otp_code'];

    public function farmer() { return $this->belongsTo(Farmer::class); }
}
