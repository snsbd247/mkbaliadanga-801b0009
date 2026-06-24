<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Land extends Model
{
    use HasUuids, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $guarded = ['id'];

    protected $casts = [
        'katha'     => 'decimal:4',
        'shatak'    => 'decimal:4',
        'is_active' => 'boolean',
        'extra'     => 'array',
    ];

    public function office()
    {
        return $this->belongsTo(Office::class);
    }

    public function farmer()
    {
        return $this->belongsTo(Farmer::class);
    }

    public function landType()
    {
        return $this->belongsTo(LandType::class);
    }
}
