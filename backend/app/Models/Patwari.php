<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Patwari extends Model
{
    use HasUuids;
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'office_id', 'created_by', 'name', 'name_bn', 'phone', 'mobile',
        'nid', 'address', 'mouza_id', 'is_active', 'note', 'extra',
    ];
    protected $casts = ['extra' => 'array', 'is_active' => 'boolean'];
}
