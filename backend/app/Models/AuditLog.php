<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model {
    use HasUuids;
    public $timestamps = false;
    protected $fillable = ['office_id','user_id','action','entity','entity_id','meta','ip','created_at'];
    protected $casts = ['meta' => 'array', 'created_at' => 'datetime'];
}
