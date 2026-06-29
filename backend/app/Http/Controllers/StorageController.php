<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Storage gateway — a Laravel replacement for Supabase Storage buckets
 * (supabase.storage.from(bucket).upload/remove/getPublicUrl).
 *
 * Files are stored on the `public` disk under storage/app/public/{bucket}
 * and served from /storage/{bucket}/{path} (run `php artisan storage:link`).
 *
 * Routes (behind auth:sanctum):
 *   POST /api/storage/upload   multipart: bucket, path, file
 *   POST /api/storage/remove   { bucket, paths: [] }
 */
class StorageController extends Controller
{
    private function safe(string $value): string
    {
        if (! preg_match('/^[A-Za-z0-9._\/-]+$/', $value)) {
            abort(400, 'Invalid storage path.');
        }
        if (str_contains($value, '..')) {
            abort(400, 'Invalid storage path.');
        }
        return trim($value, '/');
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'bucket' => 'required|string',
            'path' => 'required|string',
            'file' => 'required|file|max:10240',
        ]);
        $bucket = $this->safe($request->input('bucket'));
        $path = $this->safe($request->input('path'));
        $full = "$bucket/$path";

        $request->file('file')->storePubliclyAs(
            dirname($full) === '.' ? '' : dirname($full),
            basename($full),
            ['disk' => 'public'],
        );

        return response()->json(['path' => $path, 'fullPath' => $full]);
    }

    public function remove(Request $request): JsonResponse
    {
        $request->validate([
            'bucket' => 'required|string',
            'paths' => 'required|array',
        ]);
        $bucket = $this->safe($request->input('bucket'));
        foreach ($request->input('paths') as $p) {
            Storage::disk('public')->delete("$bucket/" . $this->safe($p));
        }
        return response()->json(['ok' => true]);
    }
}
