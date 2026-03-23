---
name: Phase 2 frontend security review findings
description: Key security findings from the Phase 2 frontend review (March 2026) — useful context for future reviews of this codebase
type: project
---

Completed initial security review of Phase 2 frontend (2026-03-23).

**Why:** Internal HR tool handling salary/bonus/PTO data for team members. No auth layer is implemented on the frontend.

**Key findings worth tracking:**

- `ImageUpload.tsx`: No MIME type validation, no file size limit. `accept="image/*"` is browser-hint only — a crafted file can bypass it. Any file is accepted and previewed via object URL.
- `api-client.ts`: Error messages from the backend `detail` field are forwarded directly to `toast.error()` in callers. The message string is rendered as plain text in Sonner toast (not dangerouslySetInnerHTML), so XSS risk is low — but server error messages may leak internal schema details.
- `MemberDetailSheet.tsx`: Salary, bonus, and PTO are displayed unconditionally to any authenticated user. There is no role-based visibility or masking. This is an access-control gap if the app ever gets multi-role auth.
- `MembersPage.tsx` useSearchParams: `program_id`, `area_id`, `team_id` URL params are passed directly into `new URLSearchParams()` and appended to API fetch URLs. No numeric validation before use. If the API does not validate these, SSRF-adjacent abuse is possible.
- `useMembers.ts` line 23: `useMember` passes a raw UUID string directly into the fetch URL without format validation. If a non-UUID is supplied (e.g. via detailUuid state), it creates a malformed API path.
- No `dangerouslySetInnerHTML` found anywhere in the codebase — XSS via raw HTML is not a risk.
- No auth/session tokens stored in localStorage or sessionStorage.
- No console.log leaks of sensitive data found.

**How to apply:** When reviewing future changes to ImageUpload, compensation display, or any component that builds API paths from URL params, reference these existing gaps. Don't flag them as new issues — note if they are resolved or worsened.
