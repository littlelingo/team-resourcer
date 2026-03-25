# PRP: Security Adaptation

**Status**: COMPLETE
**Strategy**: implement-then-test

## Steps

### Step 1: CORS origins from environment
- Add `cors_origins` field to `Settings` in `backend/app/core/config.py`
- Add `CORS_ORIGINS` to `.env.example`
- Update `backend/app/main.py` to read origins from settings

### Step 2: Image extension from Pillow format (not Content-Type)
- In `image_service.py`, after `img.verify()`, re-open and use `img.format` for the extension
- Narrow the `except` clause to specific exceptions

### Step 3: Import sheets credential error message sanitization
- In `import_sheets.py`, replace `{exc}` in client-facing error with generic message
- Log full exception server-side

### Step 4: Chunked file read in import upload
- Replace single `file.read(MAX + 1)` with chunked read pattern matching `image_service.py`

### Step 5: Tests for security fixes
- Test CORS origins setting
- Test image extension derived from actual content
- Test import upload size limit with chunked reads
