<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Office extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['code','name','name_bn','address','phone','settings','is_active'];
    protected $casts = ['settings' => 'array', 'is_active' => 'boolean'];

    public function users()    { return $this->hasMany(User::class); }
    public function farmers()  { return $this->hasMany(Farmer::class); }
    public function seasons()  { return $this->hasMany(Season::class); }
}
