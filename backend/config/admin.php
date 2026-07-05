<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default admin password
    |--------------------------------------------------------------------------
    |
    | Used ONLY when a canonical admin account is created for the very first
    | time (seeder / auto-repair). It is never used to overwrite an existing
    | account's password, so a password changed by an admin survives updates.
    |
    */
    'default_password' => env('DEFAULT_ADMIN_PASSWORD', 'Admin@123'),
];
