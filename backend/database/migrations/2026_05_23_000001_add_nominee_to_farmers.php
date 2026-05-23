<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('farmers', function (Blueprint $t) {
            if (!Schema::hasColumn('farmers', 'nominee_name'))     $t->string('nominee_name')->nullable();
            if (!Schema::hasColumn('farmers', 'nominee_mobile'))   $t->string('nominee_mobile', 32)->nullable();
            if (!Schema::hasColumn('farmers', 'nominee_relation')) $t->string('nominee_relation', 50)->nullable();
            if (!Schema::hasColumn('farmers', 'nominee_nid'))      $t->string('nominee_nid', 32)->nullable();
            if (!Schema::hasColumn('farmers', 'nominee_address'))  $t->string('nominee_address', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('farmers', function (Blueprint $t) {
            $t->dropColumn([
                'nominee_name', 'nominee_mobile', 'nominee_relation',
                'nominee_nid', 'nominee_address',
            ]);
        });
    }
};
