# SAT Practice Platform

Web application for managing SAT prep: teachers create content, assign practice sets, and monitor students; students work through timed practice sets and review results.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, webpack dev/build) |
| Language | TypeScript 5 |
| Auth | NextAuth v5 (beta) — JWT strategy, Credentials provider |
| Database | SQLite via `better-sqlite3` (driver adapter) |
| ORM | Prisma 7 (TypeScript-first client, no binary engine) |
| Styling | Tailwind CSS v4 |
| UI foundation | Custom shadcn-style primitives, Radix UI, class-variance-authority, lucide-react |
| Forms / tables | React Hook Form, Zod, TanStack Table |
| Notifications | Sonner |
| Math rendering | KaTeX / react-katex |
| Runtime | Node.js 24 |

## Features

### Teacher portal (`/teacher`)
- **Dashboard** — student roster with last-active date, pending assignments, avg score, and inactive-student alerts
- **Student detail** — view full assignment history, toggle active/inactive, impersonate student view
- **Assign** — send a practice set to a student with optional due date and locked flag
- **Question bank** (`/teacher/questions`) — browse, filter (topic / difficulty / status), create and edit MC and numeric questions with LaTeX support
- **Subskills** (`/teacher/subskills`) — maintain topic subskills for filtering and question classification
- **Content map** (`/teacher/content`) — tree view of Sections → Domains → Topics → Practice Sets with published/draft counts
- **Practice set editor** — create/edit practice sets, order questions, publish/draft/archive, and control explanation visibility
- **Attempt detail** — inspect student answers and reopen or invalidate submitted attempts
- **Groups** (`/teacher/groups`) — create groups/cycles, add and remove members
- **Parents** (`/teacher/parents`) — create parent accounts and link students
- **Full Practice Tests** (`/teacher/full-tests`) — create four-module SAT-style tests and assign them to students/groups
- **Full Test scoring** (`/teacher/full-tests/scoring`) — upload RW/Math raw-score conversion rows for SAT-style scoring
- **Invite flow** — generate invite tokens sent by email; students self-activate via token link
- **Bulk import** (`/admin/import`) — import questions from CSV for content loading
- **Reports** — generate student reports and download a PDF summary

### Student portal (`/student`)
- **Dashboard** — stats (sets completed, avg score, pending count), active assignments with due dates, recent results
- **Practice player** — timed, question-by-question player with autosave, flag-for-review, numeric free-response and MC modes, pause/resume
- **Results review** — per-question breakdown with explanations (visibility controlled per set: IMMEDIATE / AFTER_FINISH / HIDDEN)
- **History** — paginated list of all submitted attempts
- **Content map** — browse practice sets by topic and difficulty for self-directed practice
- **Full Practice Tests** — take assigned four-module tests with module timers, pause/continue, Math calculator, and SAT-style section scores
- **Notifications** — see internal notifications for assignments, unlocks, due-related activity, and completed practice

### Parent portal (`/parent`)
- View linked student progress dashboards and recent practice summary

### Auth flows
- Login with email/password
- Forgot password → reset via email token
- Student invitation → activation with token
- Change password from the user menu

## Project Structure

```
sat-web/
├── app/
│   ├── (auth)/             # Login, forgot-password, reset-password, activation pages
│   ├── (teacher)/          # Teacher-only pages (layout enforces TEACHER/ADMIN role)
│   ├── (student)/          # Student pages (layout enforces auth)
│   ├── api/                # REST API routes
│   │   ├── assignments/    # CRUD for assignments
│   │   ├── attempts/       # Autosave and submit
│   │   ├── auth/           # Invite info, activate, forgot/reset password
│   │   ├── groups/         # Group and membership management
│   │   ├── questions/      # Question creation
│   │   └── students/       # Toggle active status
│   ├── generated/prisma/   # Prisma 7 generated TypeScript client (do not edit)
│   └── page.tsx            # Root redirect (→ /teacher or /student based on role)
├── components/
│   ├── ui/                 # Reusable UI primitives (forms, table, dialog, tabs, etc.)
│   ├── math-content.tsx    # LaTeX renderer (KaTeX)
│   ├── nav-teacher.tsx
│   └── nav-student.tsx
├── lib/
│   ├── auth.ts             # NextAuth config + handlers
│   ├── prisma.ts           # PrismaClient singleton (better-sqlite3 driver adapter)
│   └── utils.ts            # Shared helpers (formatDate, scorePercent, etc.)
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Dev seed data
│   └── migrations/         # SQL migration history
├── proxy.ts                # CORS headers for API routes
└── next.config.ts          # serverExternalPackages for native modules
```

## Data Model (summary)

```
User (STUDENT | TEACHER | ADMIN)
  └── GroupMembership → Group
  └── Assignment → PracticeSet → PracticeSetQuestion → Question
  └── Attempt → AttemptAnswer
  └── FullPracticeTestAssignment → FullPracticeTestAttempt → FullPracticeTestAnswer

ParentStudent links PARENT users to STUDENT users.

Section → Domain → Topic → Question
                         → PracticeSet
                         → FullPracticeTestModule
```

Key enums (stored as strings in SQLite):
- `User.role`: `STUDENT` | `TEACHER` | `ADMIN`
- `Question.type`: `MC` | `NUMERIC`
- `Question.difficulty` / `PracticeSet.difficulty`: `EASY` | `MEDIUM` | `HARD`
- `Question.status` / `PracticeSet.status`: `DRAFT` | `PUBLISHED` | `ARCHIVED` (sets also: `BLOCKED`)
- `PracticeSet.explanationVisibility`: `IMMEDIATE` | `AFTER_FINISH` | `HIDDEN`
- `Attempt.status`: `IN_PROGRESS` | `SUBMITTED` | `INVALIDATED`

## Setup

### Prerequisites
- Node.js 24+
- npm

### Install

```bash
npm install
```

For CI or clean reproducible installs, prefer:

```bash
npm ci
```

### Environment

Create `.env` in the project root:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-this-to-a-random-string"
AUTH_URL="http://localhost:3000"
CORS_ALLOWED_ORIGINS="http://localhost:3000,https://your-frontend-domain.com"

# Required for email flows via Brevo SMTP (invite / parent consent / password reset)
# EMAIL_FROM must be a sender verified in Brevo.
EMAIL_FROM="noreply@yourdomain.com"
EMAIL_HOST="smtp-relay.brevo.com"
EMAIL_PORT="587"
EMAIL_USER="your-brevo-smtp-login"
EMAIL_PASS="your-brevo-smtp-key"
BACKUP_DIR="./backups"
```

Use `.env.example` as the non-secret reference for local or deployment configuration.

Brevo setup notes:
- Create or use a verified sender/domain in Brevo and set it as `EMAIL_FROM`.
- Use the SMTP login and SMTP key from Brevo, not your Brevo account password.
- Port `587` uses STARTTLS; the app automatically uses SSL only for port `465`.
- If SMTP variables are missing, email sending is skipped and the generated link is logged for local development.

### Database

```bash
# Run migrations
npx prisma migrate deploy

# Seed development data (creates teacher + 4 students + sample content)
npm run db:seed
```

Seed credentials:
- Admin: `admin@sat.com` / `admin123`
- Teacher: `teacher@sat.com` / `teacher123`
- Students: `student1@sat.com` … `student4@sat.com` / `student123`

To reset and re-seed from scratch:

```bash
npm run db:reset
```

### Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Known Issues / Configuration Notes

### Native module bundling / SWC

`better-sqlite3` is a native C++ addon and must be excluded explicitly in `next.config.ts`:

```ts
serverExternalPackages: [
  "better-sqlite3",
  "@prisma/adapter-better-sqlite3",
  "@prisma/client",
  "bcryptjs",
],
```

The project uses the native Next SWC package for Linux (`@next/swc-linux-x64-gnu`). Do not force the WASM SWC fallback in local scripts; in this environment it caused unstable build workers.

### API CORS

API routes under `/api/*` are covered by `proxy.ts`. Allowed origins come from:
- `CORS_ALLOWED_ORIGINS` as a comma-separated list
- `AUTH_URL`
- `http://localhost:3000` and `http://127.0.0.1:3000` outside production

Because the app uses cookie-based auth, CORS does not use `*`; each allowed origin is echoed explicitly with credentials enabled.

### Frontend / Backend Security Boundary

This is a full-stack Next.js app:
- frontend: pages and client components under `app/**` and `components/**`
- backend: API routes under `app/api/**`, server components, Prisma, and auth utilities

Client components never receive database credentials, SMTP credentials, `AUTH_SECRET`, or password hashes. Browser actions call backend endpoints with the session cookie, and backend routes re-check authentication, role, ownership, lock state, and attempt ownership before writing data. Teacher/admin endpoints explicitly require `TEACHER` or `ADMIN`.

### Backups and Observability

SQLite backups can be created with:

```bash
npm run db:backup
```

Set `BACKUP_DIR` to control the destination directory. The app emits structured JSON logs for CORS blocks and backup creation. Critical teacher/admin actions are also stored in `AuditLog`.

### Prisma 7 generated client location

The generated client lives in `app/generated/prisma/` (configured in `schema.prisma`). This is inside Next.js's `app/` directory, which Turbopack treats specially. If requests hang on startup, check that `serverExternalPackages` is correct and the `.next/` cache is clean (`rm -rf .next`).

### Route protection

Route protection is enforced in each layout:
- `app/(teacher)/layout.tsx` — requires TEACHER or ADMIN role
- `app/(student)/layout.tsx` — requires any authenticated session
- `app/page.tsx` — redirects based on role

Next proxy is only used for CORS headers and lightweight API request events, avoiding database/auth work in the Edge runtime.

### Account validation

Every user has a validation status:
- `PENDING` — account exists but cannot access role portals yet
- `APPROVED` — account can use the platform
- `REJECTED` — account remains blocked after review

Accounts created through emailed invite/authorization links are approved automatically when the token is consumed, because the email link validates ownership of the mailbox. Manually created accounts default to `PENDING` and must be reviewed by an admin at `/admin/users`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with webpack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run prisma:validate` | Validate Prisma schema/configuration |
| `npm run quality` | Run Prisma validation, lint, typecheck, and build |
| `npm run db:seed` | Seed the database |
| `npm run db:reset` | Drop, re-migrate, and re-seed the database |
| `npm run db:backup` | Copy the SQLite database to `BACKUP_DIR` |

## Professionalization Plan

The post-MVP hardening plan lives in [`PROFESSIONALIZATION_PLAN.md`](./PROFESSIONALIZATION_PLAN.md). It tracks repository hygiene, CI, UI foundation, functional quality gates, product polish, and production readiness.

Current quality gate:

```bash
npm run quality
```
