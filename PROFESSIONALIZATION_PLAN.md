# SAT Manager Platform - Professionalization Plan

## Objective

Move the current MVP into a maintainable production-track codebase without rewriting the application. The MVP is already functional, so the plan favors incremental hardening: preserve feature behavior, add quality gates, improve UI primitives, and create a safer foundation for future functional work.

## Current Baseline

- Next.js 16 App Router with TypeScript and Prisma 7.
- SQLite with a single unified migration.
- Credential-based NextAuth v5 authentication.
- Teacher, student, parent, and admin surfaces.
- RBAC enforced in layouts and backend route handlers.
- Frontend and backend are separated through Next API routes and server components.
- UI is Tailwind CSS v4 with small custom primitives.

## Principles

- Keep the MVP deployable after every change.
- Make improvements in small commits after the initial MVP snapshot.
- Avoid database churn unless a functional requirement needs it.
- Keep the single migration policy until the project is ready for production migration history.
- Use backend validation for every privileged action; do not trust client state.
- Prefer reusable UI primitives over page-level style drift.

## Phase 1 - Repository And Delivery Hygiene

Status: in progress

Acceptance criteria:

- Runtime secrets and local data files are ignored.
- `.env.example` documents required configuration without secrets.
- Package scripts expose repeatable quality checks.
- CI validates install, Prisma schema, TypeScript, lint, and production build.
- README names the professionalization baseline and quality workflow.

Planned work:

- Add database runtime artifacts to `.gitignore`.
- Add `.env.example`.
- Add `typecheck`, `prisma:validate`, and `quality` scripts.
- Add GitHub Actions workflow for CI.

## Phase 2 - UI Foundation

Status: in progress

Acceptance criteria:

- Existing pages continue to compile without a full UI rewrite.
- Core primitives support a more professional, consistent design language.
- The stack can support complex tables, dialogs, dropdowns, tabs, tooltips, and forms.
- New UI dependencies are justified by current and near-term screens.

Recommended stack:

- Keep Next.js 16, React 19, Tailwind CSS v4, and lucide-react.
- Add class-variance-authority for variant-safe primitives.
- Add Radix primitives for accessible behavior where native elements are insufficient.
- Add TanStack Table for admin/teacher data grids.
- Add React Hook Form plus Zod resolvers for larger forms.
- Add Sonner for consistent toast notifications.

Planned work:

- Upgrade existing `Button` to a variant-driven primitive compatible with current usage.
- Add professional primitives: `Label`, `Table`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`, `Form`, and `Toaster`.
- Keep existing `Input`, `Textarea`, `Select`, `Card`, and `Badge` imports stable.

## Phase 3 - Functional Quality Gates

Status: planned

Acceptance criteria:

- Critical user lifecycle has automated coverage:
  - teacher active check
  - program creation by active teacher
  - invite creation with program selection
  - parent consent
  - student activation
  - enrollment into program
- Backend route handlers reject unauthorized users and inactive teachers.
- Full build remains green after schema or RBAC changes.

Planned work:

- Introduce a test runner after the current UI foundation is stable.
- Add service-level tests around auth/RBAC/lifecycle logic.
- Extract repeated route validation into small server helpers where it reduces duplication.

## Phase 4 - Product UI Polish

Status: planned

Acceptance criteria:

- Teacher/admin data-heavy screens use tables with predictable density and empty/loading states.
- Forms have labels, help/error text, validation messages, and consistent submit states.
- Student practice surfaces remain SAT-like and focused.
- Navigation clearly separates teacher, admin, student, and parent responsibilities.

Planned work:

- Migrate `/teacher/students`, `/teacher/questions`, `/admin/programs`, and `/admin/teachers` to table primitives.
- Convert long forms to React Hook Form + Zod.
- Add toast feedback for mutations.
- Normalize page headers and toolbar layouts.

## Phase 5 - Production Readiness

Status: planned

Acceptance criteria:

- Deployment environment is documented.
- Backups are tested.
- Audit logs cover admin/teacher critical mutations.
- Observability includes structured error and security events.
- SQLite limitations are explicitly accepted or a Postgres migration is planned.

Planned work:

- Add deployment checklist.
- Add backup restore procedure.
- Add operational runbook for migrations, seed, and rollback.
- Reassess database choice once active usage exceeds MVP scale.
