<?php

// CORS is locked to explicit origins. With supports_credentials=true a
// wildcard "*" is both insecure and rejected by browsers, so we read a
// comma-separated allow-list from CORS_ALLOWED_ORIGINS (set in .env on the
// VPS, e.g. https://mohammadkhani.com) and fall back to APP_URL.
$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('APP_URL', '')))
)));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => empty($origins) ? [] : $origins,
    // Google AI Studio apps run on rotating preview origins. Allow the known
    // editor + preview hosts by pattern instead of a fixed origin.
    'allowed_origins_patterns' => [
        '#^https://([a-z0-9-]+\.)*usercontent\.goog$#',
        '#^https://aistudio\.google\.com$#',
        '#^https://ai\.studio$#',
        '#^https://ai\.google\.dev$#',
        '#^https://([a-z0-9-]+\.)*scf\.usercontent\.goog$#',
    ],
    // AI Studio/generated apps may send extra non-sensitive request headers;
    // echo allowed requested headers so preflight does not fail.
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => true,
];
