# PRP: Adapt Security

## Goal
Fix security findings from `/adapt` audit.

## Steps

### Step 1: Harden CORS default (MEDIUM)
- File: `backend/app/core/config.py:16`
- Change `cors_origins` default from `"http://localhost:5173,http://localhost:3000"` to `""`
- Update `backend/app/main.py` to log a warning when CORS origins list is empty

### Step 2: Log rejected image uploads (LOW)
- File: `backend/app/services/image_service.py:45-46`
- Add `logger.debug()` before raising ValueError on invalid images

## Testing Strategy
implement-then-test — run existing test suite after changes.
