<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CardSettings extends Model
{
    protected $table = 'card_settings';
    public $timestamps = false;
    protected $guarded = [];
    protected $fillable = ['template_id', 'accent_color', 'header_text', 'header_text_bn', 'show_photo', 'show_account_number', 'show_voter_number', 'show_issue_date', 'show_qr', 'photo_size_mm', 'font_scale', 'updated_by', 'header_height_mm', 'logo_size_mm', 'custom_text', 'custom_text_bn'];
}
