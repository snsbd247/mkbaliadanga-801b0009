<?php

namespace App\Http\Controllers;

use App\Models\Farmer;
use App\Repositories\Contracts\FarmerRepositoryInterface;
use Illuminate\Http\Request;

class FarmerController extends Controller
{
    public function __construct(private FarmerRepositoryInterface $repo) {}

    public function index(Request $r) {
        $this->authorize('viewAny', Farmer::class);
        return $this->repo->paginateForOffice(app('current_office_id'), $r->only('q','is_active','village_id','sort','dir'), (int)($r->per_page ?? 25));
    }

    public function show(string $id) {
        $f = $this->repo->findInOffice($id, app('current_office_id'));
        abort_unless($f, 404);
        $this->authorize('view', $f);
        return $f->load('lands');
    }

    public function store(Request $r) {
        $this->authorize('create', Farmer::class);
        $data = $r->validate([
            'code'      => 'required|string|size:5|regex:/^\d{5}$/',
            'name'      => 'required|string|max:191',
            'name_bn'   => 'nullable|string',
            'mobile'    => 'nullable|string|max:32',
            'nid'       => 'nullable|string|max:32',
            'village_id'=> 'nullable|uuid',
            'address'   => 'nullable|string',
            'is_voter'  => 'boolean',
            'nominee_name'     => 'nullable|string|max:191',
            'nominee_mobile'   => 'nullable|string|max:32',
            'nominee_relation' => 'nullable|string|max:50',
            'nominee_nid'      => 'nullable|string|max:32',
            'nominee_address'  => 'nullable|string|max:255',
        ]);
        $data['office_id'] = app('current_office_id');
        return response()->json($this->repo->create($data), 201);
    }

    public function update(Request $r, string $id) {
        $f = $this->repo->findInOffice($id, app('current_office_id'));
        abort_unless($f, 404);
        $this->authorize('update', $f);
        $data = $r->validate([
            'name'    => 'sometimes|string',
            'name_bn' => 'nullable|string',
            'mobile'  => 'nullable|string|max:32',
            'address' => 'nullable|string',
            'is_active'=> 'boolean',
            'nominee_name'     => 'nullable|string|max:191',
            'nominee_mobile'   => 'nullable|string|max:32',
            'nominee_relation' => 'nullable|string|max:50',
            'nominee_nid'      => 'nullable|string|max:32',
            'nominee_address'  => 'nullable|string|max:255',
        ]);
        return $this->repo->update($f, $data);
    }

    public function destroy(string $id) {
        $f = $this->repo->findInOffice($id, app('current_office_id'));
        abort_unless($f, 404);
        $this->authorize('delete', $f);
        $this->repo->delete($f);
        return response()->noContent();
    }
}
