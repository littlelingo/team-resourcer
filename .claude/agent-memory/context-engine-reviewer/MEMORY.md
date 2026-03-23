# Reviewer Agent Memory

## Index

- [project_phase1_findings.md](project_phase1_findings.md) — Phase 1 review findings: critical bugs, fragile areas, and patterns to watch
- [project_phase1_architecture.md](project_phase1_architecture.md) — Phase 1 backend structure: layers, route nesting, scope boundaries
- [security_findings_phase1.md](security_findings_phase1.md) — Phase 1 security review: CVEs, content-type spoofing, missing validators, committed .env, exposed DB port
- [project_phase1.md](project_phase1.md) — Phase 1 design decisions: single-user no-auth, all ORM queries, image naming scheme

## Phase 2 Frontend
- [project_phase2_frontend.md](project_phase2_frontend.md) — Phase 2 frontend tech stack, architecture decisions, and key fragile areas
- [project_security_review_phase2.md](project_security_review_phase2.md) — Phase 2 security review: ImageUpload constraints, compensation data exposure, URL param injection, error leakage

## Known Issues / Fragile Areas (Phase 2)
- [feedback_http_method_mismatch.md](feedback_http_method_mismatch.md) — Backend uses PUT, frontend uses PATCH for update mutations
- [feedback_program_assignments_not_submitted.md](feedback_program_assignments_not_submitted.md) — Program assignments in MemberFormDialog collected but never sent to API
- [feedback_stale_closure_delete_team.md](feedback_stale_closure_delete_team.md) — TeamsPage useDeleteTeam hook initialized with area_id 0 placeholder; potential stale closure
- [feedback_image_upload_not_wired.md](feedback_image_upload_not_wired.md) — ImageUpload component exists but upload API call is never made
