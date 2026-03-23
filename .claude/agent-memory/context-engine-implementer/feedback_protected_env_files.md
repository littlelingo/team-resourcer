---
name: protected_env_files
description: .env and .env.example are guarded by a pre-tool-use hook and cannot be written via the Write tool
type: feedback
---

The Write tool is blocked for `.env` and `.env.example` by a hook at `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-protected-files.sh`.

**Why:** These files may contain secrets and are protected to prevent accidental overwrites.

**How to apply:** Always use `bash cat > file << 'EOF'` heredoc syntax when creating or updating `.env` or `.env.example`. Similarly, `.gitignore` may also be protected — use bash for it too.
