---
name: Phase 1 Security Findings
description: Key security issues found during Phase 1 security review — CVEs, content-type spoofing, missing validators, committed .env
type: project
---

Key findings from Phase 1 security review (2026-03-22):

1. **CVEs in pinned deps** — python-multipart 0.0.19 (CVE-2026-24486), pillow 11.1.0 (CVE-2026-25990), starlette 0.41.3 (CVE-2025-54121, CVE-2025-62727). Fix: bump all four.
2. **.env committed to repo** — contains real credentials (resourcer/resourcer). .gitignore lists .env but the file is present.
3. **Content-type trust** — image_service.py trusts client-supplied Content-Type header without reading file magic bytes. Pillow is in requirements but unused.
4. **Missing string length validators** — ProgramCreate.name, FunctionalAreaCreate.name, TeamCreate.name have no max-length constraints at schema level (DB layer has String(255) but Pydantic does not enforce).
5. **postgres port exposed** — docker-compose.yml publishes port 5432 to host, reachable with default credentials.
6. **CORS allow_credentials + wildcard methods/headers** — not critical for localhost but worth tightening when deployed.
7. **ValueError details surfaced to client** — org.py:29 and members.py:89 pass internal ValueError messages directly to HTTP 400 detail.

**Why:** These were flagged in the first end-to-end security review.
**How to apply:** Check these areas first in any future review of Phase 1 code. The CVEs should be re-checked against updated requirements.txt.
