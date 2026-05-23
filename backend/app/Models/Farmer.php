<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;

class Farmer extends Model {
    use HasUuids, SoftDeletes, HasApiTokens;
    protected $fillable = [
        'office_id','code','name','name_bn','father_name','mother_name','mobile','nid','dob',
        'gender','village_id','address','photo_path','is_voter','joined_on','extra','is_active',
        'nominee_name','nominee_mobile','nominee_relation','nominee_nid','nominee_address',
    ];
    protected $casts = [
        'dob'        => 'date',
        'joined_on'  => 'date',
        'is_voter'   => 'boolean',
        'is_active'  => 'boolean',
        'extra'      => 'array',
    ];

    public function office()       { return $this->belongsTo(Office::class); }
    public function lands()        { return $this->hasMany(Land::class); }
    public function loans()        { return $this->hasMany(Loan::class); }
    public function savings()      { return $this->hasMany(SavingsAccount::class); }
    public function payments()     { return $this->hasMany(Payment::class); }
    public function credentials()  { return $this->hasOne(FarmerCredential::class); }
}
