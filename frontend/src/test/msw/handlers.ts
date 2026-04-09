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
        city: null,
        state: null,
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

  // ─── Agencies ─────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/agencies/`, () =>
    HttpResponse.json([{ id: 1, name: 'Acme Corp', description: 'External agency' }]),
  ),

  http.post(`${BASE}/api/agencies/`, () =>
    HttpResponse.json({ id: 2, name: 'New Agency', description: null }, { status: 201 }),
  ),

  http.put(`${BASE}/api/agencies/:id`, () =>
    HttpResponse.json({ id: 1, name: 'Acme Corp Updated', description: 'External agency' }),
  ),

  http.delete(`${BASE}/api/agencies/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ─── Import ───────────────────────────────────────────────────────────────────
  http.post(`${BASE}/api/import/preview`, () =>
    HttpResponse.json({ rows: [], error_count: 0, warning_count: 0 }),
  ),

  // ─── Calibration ─────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/calibration-cycles/`, () =>
    HttpResponse.json([
      {
        id: 1,
        label: '2026 Q1',
        sequence_number: 1,
        start_date: '2026-01-01',
        end_date: '2026-03-31',
        is_active: true,
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]),
  ),

  http.post(`${BASE}/api/calibration-cycles/`, () =>
    HttpResponse.json(
      {
        id: 2,
        label: '2026 Q2',
        sequence_number: 2,
        start_date: null,
        end_date: null,
        is_active: true,
        notes: null,
        created_at: '2026-04-01T00:00:00Z',
      },
      { status: 201 },
    ),
  ),

  http.get(`${BASE}/api/calibrations/latest`, () =>
    HttpResponse.json([
      {
        id: 1,
        member_uuid: 'uuid-1',
        cycle_id: 1,
        box: 4,
        reviewers: null,
        high_growth_or_key_talent: null,
        ready_for_promotion: 'Yes',
        can_mentor_juniors: null,
        next_move_recommendation: null,
        rationale: 'Strong quarter',
        effective_date: '2026-03-15',
        created_at: '2026-03-15T00:00:00Z',
        updated_at: '2026-03-15T00:00:00Z',
        cycle: { id: 1, label: '2026 Q1', sequence_number: 1, start_date: null, end_date: null, is_active: true, notes: null, created_at: '2026-01-01T00:00:00Z' },
        label: 'High Prof+',
        performance: 3,
        potential: 2,
      },
    ]),
  ),

  http.get(`${BASE}/api/calibrations/movement`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${BASE}/api/calibrations/trends`, () =>
    HttpResponse.json([]),
  ),

  http.get(`${BASE}/api/members/:uuid/calibrations/`, () =>
    HttpResponse.json([
      {
        id: 1,
        member_uuid: 'uuid-1',
        cycle_id: 1,
        box: 4,
        reviewers: null,
        high_growth_or_key_talent: null,
        ready_for_promotion: 'Yes',
        can_mentor_juniors: null,
        next_move_recommendation: null,
        rationale: 'Strong quarter',
        effective_date: '2026-03-15',
        created_at: '2026-03-15T00:00:00Z',
        updated_at: '2026-03-15T00:00:00Z',
        cycle: { id: 1, label: '2026 Q1', sequence_number: 1, start_date: null, end_date: null, is_active: true, notes: null, created_at: '2026-01-01T00:00:00Z' },
        label: 'High Prof+',
        performance: 3,
        potential: 2,
      },
    ]),
  ),

  http.post(`${BASE}/api/members/:uuid/calibrations/`, () =>
    HttpResponse.json(
      {
        id: 2,
        member_uuid: 'uuid-1',
        cycle_id: 1,
        box: 5,
        reviewers: null,
        high_growth_or_key_talent: null,
        ready_for_promotion: null,
        can_mentor_juniors: null,
        next_move_recommendation: null,
        rationale: null,
        effective_date: '2026-03-31',
        created_at: '2026-03-31T00:00:00Z',
        updated_at: '2026-03-31T00:00:00Z',
        cycle: { id: 1, label: '2026 Q1', sequence_number: 1, start_date: null, end_date: null, is_active: true, notes: null, created_at: '2026-01-01T00:00:00Z' },
        label: 'Key Performer',
        performance: 2,
        potential: 2,
      },
      { status: 201 },
    ),
  ),

  http.put(`${BASE}/api/members/:uuid/calibrations/:id`, () =>
    HttpResponse.json({
      id: 1,
      member_uuid: 'uuid-1',
      cycle_id: 1,
      box: 3,
      reviewers: null,
      high_growth_or_key_talent: null,
      ready_for_promotion: null,
      can_mentor_juniors: null,
      next_move_recommendation: null,
      rationale: 'Updated',
      effective_date: '2026-03-15',
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
      cycle: { id: 1, label: '2026 Q1', sequence_number: 1, start_date: null, end_date: null, is_active: true, notes: null, created_at: '2026-01-01T00:00:00Z' },
      label: 'Enigma',
      performance: 1,
      potential: 3,
    }),
  ),

  http.delete(`${BASE}/api/members/:uuid/calibrations/:id`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.post(`${BASE}/api/calibrations/resolve-ambiguous`, () =>
    HttpResponse.json({ created_calibrations: 1, updated_calibrations: 0 }),
  ),
]
