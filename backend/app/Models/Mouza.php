<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Mouza extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['union_id', 'name', 'name_bn', 'jl_no', 'extra'];
    protected $casts = ['extra' => 'array'];
}
