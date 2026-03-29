# Signal → Recommendation Lookup

| Signal | Threshold | Recommendation |
|--------|-----------|----------------|
| Feature elapsed > 3 sessions | 3+ sessions | Break into smaller PRPs |
| Error hit rate < 30% | < 30% over 5 features | Review error index for stale entries |
| Error hit rate > 70% | > 70% over 5 features | Errors are well-documented, focus on prevention |
| Knowledge growth = 0 for 3+ features | 0 entries | Check if learnings are being captured |
| Clears per feature > 3 | 3+ clears | Context budget too small or PRP too large |
| Rollbacks > 1 per feature | 2+ rollbacks | PRP planning needs improvement |
