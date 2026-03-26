import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8000'

export const handlers = [
  // ─── Members ──────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/members/`, () =>
    HttpResponse.json([
      {
        uuid: 'uuid-1',
        first_name: 'Alice',
        last_name: 'Example',
        employee_id: 'E001',
        title: 'Engineer',
        image_path: null,
        location: null,
        email: null,
      },
    ]),
  ),

  http.get(`${BASE}/api/members/:uuid`, () =>
    HttpResponse.json({
      uuid: 'uuid-1',
      first_name: 'Alice',
      last_name: 'Example',
      employee_id: 'E001',
      title: 'Engineer',
      image_path: null,
    }),
  ),

  http.post(`${BASE}/api/members/`, () =>
    HttpResponse.json(
      { uuid: 'uuid-new', first_name: 'Bob', last_name: 'New', employee_id: 'E002' },
      { status: 201 },
    ),
  ),

  http.put(`${BASE}/api/members/:uuid`, () =>
    HttpResponse.json({ uuid: 'uuid-1', first_name: 'Alice', last_name: 'Updated' }),
  ),

  http.delete(`${BASE}/api/members/:uuid`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Programs ─────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/programs/`, () =>
    HttpResponse.json([{ id: 1, name: 'Alpha Program' }]),
  ),

  http.get(`${BASE}/api/programs/:id/members`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${BASE}/api/programs/:id/tree`, () =>
    HttpResponse.json({ nodes: [], edges: [] }),
  ),

  http.get(`${BASE}/api/programs/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Alpha Program' }),
  ),

  http.post(`${BASE}/api/programs/`, () =>
    HttpResponse.json({ id: 2, name: 'Beta Program' }, { status: 201 }),
  ),

  http.put(`${BASE}/api/programs/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Alpha Updated' }),
  ),

  http.delete(`${BASE}/api/programs/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Trees ────────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/org/tree`, () =>
    HttpResponse.json({ nodes: [], edges: [] }),
  ),

  http.get(`${BASE}/api/areas/:id/tree`, () =>
    HttpResponse.json({ nodes: [], edges: [] }),
  ),

  // ─── Org operations ───────────────────────────────────────────────────────────
  http.put(`${BASE}/api/org/members/:uuid/supervisor`, () =>
    HttpResponse.json({ uuid: 'uuid-1' }),
  ),

  // ─── Program assignments ──────────────────────────────────────────────────────
  http.post(`${BASE}/api/programs/:id/assignments`, () =>
    HttpResponse.json({}, { status: 201 }),
  ),

  http.delete(`${BASE}/api/programs/:id/assignments/:uuid`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Functional Areas ──────────────────────────────────────────────────────────
  http.get(`${BASE}/api/areas/`, () =>
    HttpResponse.json([{ id: 1, name: 'Engineering', description: null }]),
  ),

  http.post(`${BASE}/api/areas/`, () =>
    HttpResponse.json({ id: 2, name: 'Design', description: null }, { status: 201 }),
  ),

  http.put(`${BASE}/api/areas/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Engineering Updated', description: null }),
  ),

  http.delete(`${BASE}/api/areas/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Teams ────────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/areas/:areaId/teams/`, () =>
    HttpResponse.json([{ id: 1, name: 'Team Alpha', functional_area_id: 1 }]),
  ),

  http.post(`${BASE}/api/areas/:areaId/teams/`, () =>
    HttpResponse.json({ id: 2, name: 'Team Beta', functional_area_id: 1 }, { status: 201 }),
  ),

  http.put(`${BASE}/api/areas/:areaId/teams/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Team Alpha Updated', functional_area_id: 1 }),
  ),

  http.delete(`${BASE}/api/areas/:areaId/teams/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Import ───────────────────────────────────────────────────────────────────
  http.post(`${BASE}/api/import/preview`, () =>
    HttpResponse.json({ rows: [], error_count: 0, warning_count: 0 }),
  ),
]
