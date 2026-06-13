<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mouzas extends Model
{
    protected $table = 'mouzas';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['upazila_id', 'name', 'name_bn', 'code', 'is_active'];
}
