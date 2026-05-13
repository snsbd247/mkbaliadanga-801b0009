<?php

use App\Jobs\MonthlyReconciliationJob;
use App\Jobs\SendDueRemindersJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', fn () => $this->comment(Inspiring::quote()))->purpose('Display an inspiring quote');

// ───── Scheduler ─────────────────────────────────────────────────────────
Schedule::job(new SendDueRemindersJob)->dailyAt('07:30')->name('due-reminders')->onOneServer();
Schedule::job(new MonthlyReconciliationJob)->monthlyOn(1, '02:00')->name('monthly-reconcile')->onOneServer();
Schedule::command('queue:prune-failed --hours=168')->dailyAt('03:00');
Schedule::command('sanctum:prune-expired --hours=24')->dailyAt('03:15');
Schedule::command('mkb:integrity-scan')->dailyAt('02:30')->onOneServer();
Schedule::command('mkb:backup')->dailyAt('01:00')->onOneServer();
