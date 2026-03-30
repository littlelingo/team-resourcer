# Error Index

Known errors and their resolutions.

| Error | Cause | Fix | Feature |
|-------|-------|-----|---------|
| 422 on `POST /api/areas/{id}/teams/` | `TeamCreate.functional_area_id` is required but frontend omits it (path param injection pattern) | Remove `functional_area_id` from `TeamCreate` schema | 015 |
