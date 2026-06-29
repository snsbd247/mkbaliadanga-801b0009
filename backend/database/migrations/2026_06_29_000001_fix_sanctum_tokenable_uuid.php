<?php

use App\Support\SanctumTokenSchema;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        SanctumTokenSchema::ensureUuidTokenableId();
    }

    public function down(): void
    {
        // Do not revert: UUID token columns are required by this application.
    }
};