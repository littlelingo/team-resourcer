---
name: shadcn/ui CLI avoid interactive prompts
description: Install shadcn/ui Radix primitives manually rather than running the shadcn CLI to avoid interactive prompt issues in Docker/CI
type: feedback
---

Do not use `npx shadcn@latest init` or `npx shadcn@latest add` in plans that run inside Docker containers or CI. These commands require interactive terminal input and will hang or fail non-interactively.

**Why:** The shadcn CLI prompts for configuration choices that cannot be answered in a non-TTY environment.

**How to apply:** In any plan that sets up shadcn/ui, install the underlying Radix UI primitives, class-variance-authority, clsx, tailwind-merge, and lucide-react directly via npm. Write the component files (cn utility, individual shadcn components) by hand when needed.
