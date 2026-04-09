# Dependency Pins & Workarounds

Track libraries with version constraints, resolution workarounds, or known compatibility friction.

---

## Visx 3.12.x — requires `--legacy-peer-deps` on React 19

**Affected packages**: `@visx/axis`, `@visx/group`, `@visx/hierarchy`, `@visx/responsive`, `@visx/sankey`, `@visx/scale`, `@visx/shape`, `@visx/text` (all `^3.12.0`)

**Symptom**: `npm install` fails with `ERESOLVE` peer dependency conflict — Visx 3.12 declares `peer react@"^16.3.0-0 || ^17.0.0-0 || ^18.0.0-0"` but this project uses `react ^19.2.4`.

**Workaround**: Always install with `--legacy-peer-deps`:
```bash
cd frontend && npm install --legacy-peer-deps
```

**Why it's safe**: Visx 3.12 only uses React APIs that are forward-compatible with React 19 (basic hooks, refs, JSX runtime). The peer-deps cap is a stale declaration, not a real runtime incompatibility. Verified end-to-end during feature 057 implementation: 162 frontend tests pass, no React runtime warnings, Vite dev server resolves all imports cleanly.

**When to remove this workaround**: When Visx publishes a 4.x release with updated React 19 peer support. Their main branch already has the bump merged — release timing is upstream. Re-test on upgrade by running `npm install` (no flag) and confirming it succeeds.

**First introduced**: Feature 057 (member calibration / 9-box matrix), 2026-04-08. ADR-001 documents the choice to use Visx instead of Recharts/Nivo/Tremor; this pin is the cost of that choice during the React 19 transition window.
