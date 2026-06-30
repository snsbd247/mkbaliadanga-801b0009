<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Union extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $table = 'unions';
    protected $fillable = ['upazila_id', 'name', 'name_bn', 'extra'];
    protected $casts = ['extra' => 'array'];
}
