<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Divisions extends Model
{
    protected $table = 'divisions';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['name', 'name_bn', 'code', 'is_active'];
}
