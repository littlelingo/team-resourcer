---
name: feedback_prp_style
description: User's preferred PRP format and level of specificity for this project
type: feedback
---

PRPs for this project should use the frontmatter + sections format specified in the prompt: frontmatter with `feature`, `phase`, `status`, `testing`, `complexity`, `depends_on` keys, then Overview, Steps (numbered), File Manifest, Validation Criteria, Testing Plan.

**Why:** User provided an explicit PRP template with frontmatter. The implementer agent consuming these plans needs exact file paths, exact commands, and exact component/prop names — no guessing allowed.

**How to apply:** Always write steps at the level of "here is the exact file, here is the exact prop interface, here is the exact command to run." Include exact shadcn component names, exact TanStack Query v5 API shapes, exact lucide-react icon names. Include a Risks section that calls out API version gotchas (e.g., TanStack Query v5 vs v4 differences, shadcn component sub-export names).
