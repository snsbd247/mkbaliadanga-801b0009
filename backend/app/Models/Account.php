<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Account extends Model {
    use HasUuids;
    protected $fillable = ['office_id','code','name','name_bn','type','parent_id','is_active'];
    protected $casts = ['is_active' => 'boolean'];
    public function parent()   { return $this->belongsTo(Account::class, 'parent_id'); }
    public function children() { return $this->hasMany(Account::class, 'parent_id'); }
}
