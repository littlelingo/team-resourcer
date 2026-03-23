---
name: Image Upload Not Wired to API
description: MemberFormDialog collects an image file via ImageUpload + imageFileRef but never calls the upload endpoint
type: feedback
---

`MemberFormDialog` has:
- An `imageFileRef = useRef<File | null>(null)`
- An `ImageUpload` component that sets `imageFileRef.current = file`
- A comment: "Create — use JSON (image upload is a future enhancement)"

The `POST /api/members/{member_uuid}/image` endpoint exists on the backend and is ready. The frontend never calls it — not on create, not on update. Users can pick a photo in the UI and it will be silently discarded on save.

**Why:** Noted as intentional future enhancement in a code comment, but the UI gives no indication to the user that photo selection is non-functional.

**How to apply:** Flag as a warning (not critical) since it's acknowledged in code, but note the UX impact: the Remove button is clickable and photo preview updates, which implies the feature works.
