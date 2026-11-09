# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SAT preparation platform: a Next.js 16 (App Router, webpack) web app backed by SQLite/Prisma, plus a standalone FastAPI service (`ingest_service/`) for AI-assisted document ingestion (PDF/DOCX/ZIP → OCR → staging → review → promotion). Four role-based portals: Admin, Teacher, Student, Parent. Most product docs and the README are in Spanish; `README.md` is the authoritative functional spec.

## Commands

```bash
npm run dev                # Next dev server (webpack) on :3000
npm run build              # Production build (webpack)
npm run lint               # eslint
npm run typecheck          # tsc --noEmit
npm run quality            # Full gate: prisma validate+generate, lint, typecheck, qa:p0/authz/edge, build

npm run db:seed            # Seed demo data (tsx prisma/seed.ts)
npm run db:reset           # migrate reset --force + reseed
npm run prisma:generate    # Regenerate client (REQUIRED after schema.prisma changes)

# Static QA gates — grep-based assertions over source, not runtime tests:
node scripts/verify-p0.mjs         # npm run qa:p0
node scripts/verify-authz.mjs      # npm run qa:authz
node scripts/verify-edge-cases.mjs # npm run qa:edge
```

There is no Jest/Vitest suite. The `qa:*` scripts assert that specific security/correctness patterns (snapshots, RBAC scoping, status guards) are present in given files by string-matching them. When you touch a file these scripts reference, keep the asserted patterns intact or the gate fails. `npm run quality` is the CI-equivalent check (see `.github/workflows/ci.yml`).

Docker: `docker-compose.yml` runs `web` (:3000) and `ingest-service` (:8000) sharing the project via bind mount and the same SQLite `dev.db`.

Deployment lives in `deploy/` (see `deploy/README.md`): Terraform for GCP under `deploy/terraform/` (modules + `environments/prod`, GCS state, production imported in `imports.tf`; `make plan` must never show a destroy/replace), VM files in `deploy/vm/` (installed by `apply-stack.sh`), and `make build` / `make release TAG=…` / `make rollback` from `deploy/`. `make preflight` runs the offline checks. Never commit `dev.db` (it can hold a production copy).

**Schema stays stable; data changes are data patches.** Any data change (content fixes, backfills, normalizing values) is a file in `prisma/data-patches/` (`YYYYMMDDHHMM_name.sql|.mjs`, DML only, `-- expect: <rows>` guard, guarded `WHERE` on id + previous value), applied once per database by `scripts/apply-data-patches.mjs`: on every deploy by the web entrypoint (a failing patch stops the container → automatic rollback) and locally with `npm run db:patch`. The ledger is `AppSetting` keys `DATA_PATCH:<file>` (no extra table). Never put DML in a new Prisma migration (`qa:p0` fails after `20261105_…` unless `-- data-in-migration: <reason>`), never run `UPDATE`s by hand on the VM, never edit an applied patch. Local `dev.db` mirrors production: `cd deploy && make pull-db`; check with `make db-compare`. See `prisma/data-patches/README.md`.

## Architecture

**Prisma client is generated to `app/generated/prisma/`, not `@prisma/client`.** Import from `@/app/generated/prisma/client`. Always run `prisma:generate` after editing `prisma/schema.prisma`. `lib/prisma.ts` wires the `better-sqlite3` adapter and is a singleton in prod but fresh-per-call in dev (so HMR never serves a stale generated client).

**No `middleware.ts` for route protection — this is deliberate.** `better-sqlite3` + Prisma adapter require Node runtime, not Edge. Auth/RBAC is enforced server-side in layouts and route handlers via helpers in `lib/rbac.ts`: `requireAdmin()`, `requireTeacherOrAdmin()`, `requireApprovedSession()`. These return `null` (not throw) when access is denied — callers must handle that. They also re-check `active` and `validationStatus === "APPROVED"` against the DB, not just the JWT.

**Teacher data access is program-scoped.** A teacher may only see students/attempts in programs they belong to. Scoping lives in `lib/program-scope.ts` (e.g. `teacherProgramEnrollmentScope`). Any new teacher-facing query over student data must apply this scope; the `qa:authz`/`qa:p0` gates check for it in specific routes.

**Auth** (`lib/auth.ts`, `lib/auth.config.ts`): NextAuth v5 beta, Credentials provider, JWT session strategy. Session carries `id`, `email`, `role`, `validationStatus`. Login is rate-limited via `lib/rate-limit.ts`. `AUTH_SECRET` is required in production (throws otherwise).

**One open attempt per assignment.** Partial unique indexes (raw SQL, migration `20261005_single_open_attempt`, not expressible in `schema.prisma`) allow at most one `IN_PROGRESS` attempt per assignment; the players catch the P2002 (`lib/db-errors.ts`) and reuse the open attempt. A generated migration that drops these indexes is wrong — keep them. The same applies to `20261105_single_open_pause_unlock_request` (one open `AttemptPause` / `FullPracticeTestPause` per attempt, one `PENDING` `UnlockRequest` per assignment; the routes catch P2002 and return the existing row).

**Attempts store answers, not questions.** An attempt keeps only its structure — `Attempt.practiceSetSnapshot` (set question order, explanation visibility) and `FullPracticeTestAttempt.testSnapshot` v2 (modules, order, question ids, pretest flags) — plus each answer and its `isCorrect`/scores. Question content (stem, options, key, explanation, images) is always read from the current `Question` (`fullTestModulesForAttempt`, results pages); `AttemptAnswer.questionSnapshot` is no longer written. When a question's key, type or options change, `regradeQuestions` (`lib/attempt-regrade.ts`) re-grades the SUBMITTED attempts that have it (no notifications/unlocks); call it from any new code path that edits keys. After data patches, the app re-grades on start (`apply-data-patches.mjs` sets AppSetting `REGRADE_PENDING`, `instrumentation-node.ts` runs `regradeAllAttempts`); `npm run regrade` is the local dry-run. Each re-graded attempt gets an `ATTEMPT_REGRADED` audit row and a "Graded again on …" note on its results page. An answered question (`lib/question-usage.ts`) can be fixed but not turned into another one: same type, same choice letters, no choice moved to another letter (use Duplicate); its edit audit keeps `previousContent`. Questions with attempts can't be deleted (archive). Submit requires the attempt to be `IN_PROGRESS`. Results rendering respects `canRevealSolutions` / `explanationVisibility`. See `lib/attempt-snapshots.ts`, `lib/full-test-snapshot.ts`, `lib/full-test-grading.ts`.

**Taxonomy — source of truth vs. current implementation (they diverge; know both).**

Authoritative hierarchy (per product owner):
```
Section/Subject → Domain → Skill/Subskill → Topic → Difficulty → Practice Set → Question
```
Here **Topic is one level BELOW Skill** (a Skill groups several Topics); `Topic` is NOT a synonym for Skill. `difficulty` (EASY/MEDIUM/HARD) is a `Question`/`PracticeSet` attribute, not an academic node.

Current code/DB do **not** yet match this:
- `TaxonomyNode` models only `AREA → DOMAIN → SKILL → SUBSKILL` — there is no `TOPIC` node under skill.
- Decision (2026-09-29): the `Subskill` table / `SUBSKILL` node is the intended home of the real **Topic** level (below Skill). It is empty on purpose (the one test row was removed); the UI rename "Subskill → Topic" and the topic catalogue are pending.
- The legacy `Topic` table is linked 1:1 to `SKILL` nodes (Topic rows ↔ SKILL nodes 1:1, same names via `taxonomyNodeId`), so in practice today **`Topic` occupies the Skill slot**. `Subskill` is empty (0 rows).
- Questions, sets, materials, reports and ingest all group by that `Topic` table, i.e. "topic" currently means "skill".

**Sections are official (migration `20261018_practice_sections`).** Practice sections are `MATH`, `READING`, `WRITING` (labels Math / Reading / Writing); `READING_WRITING` holds only the Test placeholder domain "Full Practice Test" (Tests have 2 sections). `Domain.practiceArea` is a copy of the section name kept equal by SQLite triggers (not expressible in `schema.prisma` — keep them when generating migrations). Read the area with `resolvePracticeArea(domain)` / filter with `practiceAreaDomainWhere`; never infer Reading vs Writing from domain or topic names.

So when you read `topic` in code, it is really the skill level. Aligning the model to the source of truth (adding a real Topic level below Skill) is open work — see README "Taxonomía Académica". See `lib/taxonomy.ts`, `prisma/seed.ts`.

### AI ingestion (two layers)

1. **Next.js** (`app/admin/import/ai`, `app/api/admin/ai-import/*`) — upload, batching, review wizard, incidents, promotion.
2. **FastAPI** (`ingest_service/app/main.py`) — extract text/images (pdfplumber, python-docx), OCR via Mistral (`mistral-ocr-latest`), build staging records, emit progress events.

Ingestion **never writes directly to official questions.** Documents land in `Ingest*` staging tables, get reviewed/corrected in the wizard, and only approved content is promoted (`lib/ingest-promotion.ts`) into real `Question`/`PracticeSet`/`FullPracticeTest` rows, copying approved images into `public/uploads/questions` and recording `IngestPromotionArtifact` for traceability. Web↔FastAPI calls are authenticated with `INTERNAL_INGEST_TOKEN` (`lib/internal-ingest.ts`).

**Secrets are encrypted at rest.** The Mistral API key is stored as an `AppSetting` (`MISTRAL_API_KEY_ENCRYPTED`), AES-256-GCM encrypted with `SECRET_ENCRYPTION_KEY`, keeping only a SHA-256 fingerprint + last 4 chars. `MISTRAL_API_KEY` env var is a fallback. Managed at `/admin/settings`. See `lib/secret-settings.ts`.

## Layout conventions

- Route groups: `app/(auth)`, `app/(student)`, `app/(teacher)`, `app/(parent)` for portal layouts; `app/admin/*` and `app/api/*` for admin pages and route handlers.
- Domain logic lives in `lib/*.ts` (one file per concern: assignments, scoring, notifications, rbac, taxonomy, program-scope, etc.). Prefer extending these over inlining logic in route handlers.
- Path alias: `@/*` → repo root.
- UI: Tailwind CSS v4, Radix UI primitives, lucide-react, React Hook Form + Zod, TanStack Table, KaTeX for math.

## UI states & errors (shared bases — `npm run qa:ui` enforces them)

- **Blocked controls:** use `<Button disabled>`; when the block is a rule the user can fix, pass `disabledReason="…"` (tooltip + screen-reader text). `asChild` links get `aria-disabled`. Raw custom buttons use a class from `components/ui/control-states.ts` (`BLOCKED_TEXT`, `BLOCKED_SURFACE`, `BLOCKED_SWITCH`, `SETTLED_RESULT`) and `DisabledReason`. Never `disabled:opacity-*`. Fields: `Input`/`Select`/`Textarea`/`Checkbox`/`Radio` primitives.
- **Messages:** `Alert` (`components/sat/alert.tsx`, tone error|warning|info|success|note, layout box|inline|banner) is the base; `InlineError`, `ErrorState`, `InvalidatedNotice`, `OfflineBanner`, `FormMessage` build on it. Transient feedback: `notify.error(err)` / `notify.success()` (`lib/notify-ui.ts`). Confirmations: `useConfirm()` (`components/sat/confirm-dialog.tsx`, supports `requireText`). No `window.alert/confirm/prompt`.
- **Route errors:** `RouteError` / `NotFoundView` in `error.tsx` / `not-found.tsx`.
- **API errors (server):** throw or return subclasses of `ApiError` (`lib/api-error.ts`: `BadRequestError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServiceUnavailableError`…; `ApiError.fromStatus` for runtime statuses). Handlers are wrapped in `withApiErrors` (thrown ApiError → response, anything else → logged generic 500). Wire format: `{ error, code, errors?, ...extra }`. `assertAdmin/assertTeacherOrAdmin/assertApprovedSession` (`lib/rbac.ts`) throw the right error.
- **API errors (client):** `apiFetch` / `readApiError` / `errorMessage` (`lib/api-client.ts`) → `ApiClientError { status, code, details }`. Do not parse `data.error` by hand.

## Environment & data

- Copy `.env.example` → `.env`. Key vars: `DATABASE_URL`, `AUTH_SECRET`, `SECRET_ENCRYPTION_KEY`, `INTERNAL_INGEST_TOKEN`, `AI_INGEST_SERVICE_URL`, `CORS_ALLOWED_ORIGINS`, `MISTRAL_*`, `EMAIL_*` (Brevo SMTP via nodemailer), `NEXT_PUBLIC_CALCULATOR_*`/`NEXT_PUBLIC_DESMOS_*` (embedded calculators).
- Seed demo logins (`prisma/seed.ts`): `admin@sat.com` / `admin123`, `teacher…` / `teacher123`, `student1@sat.com` etc. / `student123`. Includes users in PENDING/REJECTED states to exercise validation flows.
- DB backup/restore: `npm run db:backup` / `npm run db:restore` (→ `./backups`).

## Environment readiness (required)
Before reviewing or changing this project, inspect the complete tool inventory in
`docs/operacion/README.md` and run the relevant doctor profile. Report missing
tools, incompatible versions, stopped services and credential failures separately.
Provide exact installation and verification commands for the user's OS; do not install
system tools automatically. Never print access tokens or secret values. A missing tool
is not proof of an application defect. Windows operator commands use PowerShell 7; VM
scripts remain Bash. Consult deployed TAG, incident timestamps and logs before proposing
a production fix. Never apply Terraform plans containing destroy/replace actions.
