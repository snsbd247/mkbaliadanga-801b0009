<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsTemplates extends Model
{
    protected $table = 'sms_templates';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = true;
    protected $guarded = [];
    protected $fillable = ['key', 'name', 'body', 'variables', 'is_active', 'preferred_provider'];
}
