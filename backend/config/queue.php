<?php

return [
    'default' => env('QUEUE_CONNECTION', 'redis'),
    'connections' => [
        'sync'     => ['driver' => 'sync'],
        'database' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table'  => 'jobs',
            'queue'  => 'default',
            'retry_after' => 90,
        ],
        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue'      => env('REDIS_QUEUE', 'default'),
            'retry_after'=> 120,
            'block_for'  => null,
        ],
    ],
    'batching' => [
        'database' => env('DB_CONNECTION', 'pgsql'),
        'table'    => 'job_batches',
    ],
    'failed' => [
        'driver'   => 'database-uuids',
        'database' => env('DB_CONNECTION', 'pgsql'),
        'table'    => 'failed_jobs',
    ],
];
