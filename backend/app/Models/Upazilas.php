<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Upazilas extends Model
{
    protected $table = 'upazilas';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['district_id', 'name', 'name_bn', 'code', 'is_active'];
}
