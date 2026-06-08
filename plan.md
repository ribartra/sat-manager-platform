# SAT Platform — Interface Plan v1 (MVP)

**Date:** 2026-06-05  
**Scope:** Practice Sets MVP — delivery target 2026-07-31  
**Audience:** Teacher (1), Students (~10 active), optional Parent role (Should Have)  
**Language:** English throughout  
**Devices:** Laptop + Tablet (no mobile optimization)

---

## 1. Role Overview

| Role | Entry point | Core goal |
|------|-------------|-----------|
| Teacher | `/teacher/*` | Assign, monitor, manage content |
| Student | `/student/*` | Practice and track personal progress |
| Student (impersonated) | `/student/*` + banner | Teacher sees exactly what student sees |
| Admin/Content | `/admin/*` | Manage question bank (can be same user as Teacher in MVP) |

---

## 2. Screen Inventory

### 2.1 Auth Flow (shared)

#### `AUTH-1` — Login
```
┌─────────────────────────────────────┐
│             [Logo]                  │
│                                     │
│  Email ________________________     │
│  Password ______________________    │
│                                     │
│  [  Log In  ]                       │
│                                     │
│  Forgot your password?              │
└─────────────────────────────────────┘
```
- Single form, no role selector (role resolved from account)
- "Forgot your password?" → AUTH-2
- On success: redirect to role-specific home

#### `AUTH-2` — Forgot Password
```
Enter your email to receive a reset link.
[Email _______________] [Send Reset Link]
```
- Shows confirmation message on submit (no email-found feedback for security)

#### `AUTH-3` — Invitation Activation (student's first access)
```
Welcome! Set up your account.
Name _______________  (pre-filled from teacher invite)
Phone ______________
Password ___________
Confirm Password ___
[Activate Account]
```
- Accessed via one-time token in invitation email
- Email locked/read-only (already set by teacher)
- Invitation stores student name, email, phone, and start date (RF-1)
- On success → Student Dashboard

#### `AUTH-4` — Change Password (from account settings)
- Current password, new password, confirm
- Available inside student and teacher profiles

---

### 2.2 Student Portal

#### `STU-1` — Student Dashboard (Home)
```
┌── SAT Practice Platform ─────────────────────── [Student Name ▾] ──┐
│  Nav: Home | Content Map | History                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Hello, [Name]!  ·  Last login: Jun 4                               │
│                                                                     │
│  ┌─ Pending / Assigned ──────────────────────────────────────────┐  │
│  │  [Practice Set name]  Math · Easy  Due: Jun 10  [Start →]    │  │
│  │  [Practice Set name]  R&W · Medium  In Progress  [Continue→] │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Recent Results ──────────────────────┐  ┌─ Overall Progress ─┐ │
│  │  Algebra Easy     8/10  80%  Jun 3   │  │  Sets completed: 12│ │
│  │  Craft & Structure 6/8  75%  Jun 1   │  │  Avg score:    76% │ │
│  └───────────────────────────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```
- Pending tasks: only assigned+unlocked sets, sorted by due date
- "In Progress" badge if attempt started
- Recent results: last 5 attempts
- Locked sets are NOT shown here (teacher controls visibility)

#### `STU-2` — Content Map
```
Nav: Home | Content Map | History

┌─ Mathematics ────────────────────────────────────────┐
│  Algebra                                             │
│    ├─ Linear Equations        ● Easy  ● Med  ○ Hard  │
│    ├─ Systems of Equations    ● Easy  ○ Med  ○ Hard  │
│    └─ Inequalities            ● Easy  ○ Med  ○ Hard  │
│  Advanced Math                                       │
│    ├─ Quadratic Functions     ○ Easy  ○ Med  ○ Hard  │
│    └─ ...                                            │
│  Problem Solving & Data Analysis                     │
│  Geometry & Trigonometry                             │
└──────────────────────────────────────────────────────┘

┌─ Reading & Writing ──────────────────────────────────┐
│  Information and Ideas        ● Easy  ● Med  ○ Hard  │
│  Craft and Structure          ● Easy  ○ Med  ○ Hard  │
│  Expression of Ideas          ○ Easy  ○ Med  ○ Hard  │
│  Standard English Conventions ○ Easy  ○ Med  ○ Hard  │
└──────────────────────────────────────────────────────┘

● = enabled/available   ○ = not yet available (hidden if 0 sets)
```
- Only shows topics with at least one unlocked Practice Set
- Clicking a topic+difficulty → STU-3

#### `STU-3` — Topic Practice Sets List
```
← Content Map  /  Algebra  /  Easy

Practice Sets                                  [Filter: All | Pending | Done]

┌────────────────────────────────────────────────────────────────────────┐
│  Linear Equations — Easy #1    10 questions   Attempts: 2              │
│  Best: 9/10 (90%)  ·  Last: Jun 3                          [Review]   │
├────────────────────────────────────────────────────────────────────────┤
│  Linear Equations — Easy #2    8 questions    Attempts: 0              │
│  Not started  ·  Due: Jun 10                               [Start →]  │
├────────────────────────────────────────────────────────────────────────┤
│  Linear Equations — Easy #3    🔒 Locked                               │
│  Request unlock ↗                                                      │
└────────────────────────────────────────────────────────────────────────┘
```
- States: Start / Continue / Review / Locked
- Locked sets show "Request unlock" link (RF-17, Should Have)
- Attempts count always visible
- Score shown = last attempt (not best)
- Multiple attempts are allowed; the latest submitted attempt is the current result (RF-32)

#### `STU-4` — Practice Set Player
```
┌── [Set Name: Linear Equations Easy #2] ───── Timer: 12:34 ── [≡] ──┐
│                                                                       │
│  Question 3 of 8        ████████░░░░░░░░  [⚑ Mark for review]       │
│                                                                       │
│  ┌────────────────────────────────┐  ┌────────────────────────────┐  │
│  │                                │  │  Which value of x satisfies│  │
│  │  [Passage / Stimulus / Image]  │  │  the equation?             │  │
│  │                                │  │                            │  │
│  │  (scrollable if long)          │  │  ○ A)  x = −3             │  │
│  │                                │  │  ○ B)  x = 0              │  │
│  │                                │  │  ● C)  x = 2              │  │
│  │                                │  │  ○ D)  x = 5              │  │
│  └────────────────────────────────┘  └────────────────────────────┘  │
│                                                                       │
│  [← Back]  [Question List ▾]  [Next →]          [Submit / Finish]   │
└───────────────────────────────────────────────────────────────────────┘
```
- Two-column layout: left = stimulus/passage, right = question + options  
- Single question per screen (SAT digital fidelity — RNF-3)
- Timer always visible in top bar; can hide/show
- "≡" opens question navigator panel (STU-4b)
- Math questions: numeric input field instead of A/B/C/D
- Math formulas rendered with MathJax/KaTeX
- Autosave on every answer change and navigation
- Records started time, submitted time, total elapsed time, and per-question time spent (RF-34)
- "Finish" triggers confirmation → submit or keep reviewing

#### `STU-4b` — Question Navigator Panel (overlay/drawer)
```
┌─ Questions ──────────────────┐
│  1 ✓  2 ✓  3 ●  4 ○  5 ○   │
│  6 ○  7 ○  8 ○              │
│                              │
│  ✓ Answered  ● Current       │
│  ⚑ Marked    ○ Unanswered   │
│                              │
│  [Pause & Exit]  [Close ×]  │
└──────────────────────────────┘
```
- Click any question number to jump directly
- "Pause & Exit" saves state and returns to STU-3

#### `STU-5` — Practice Set Results
```
┌── Results: Linear Equations Easy #2 ─────────────────────────────┐
│                                                                    │
│   Score:  6 / 8       75%       Time: 08:42                       │
│   ✓ Correct: 6   ✗ Incorrect: 1   – Unanswered: 1                 │
│                                                                    │
│   Attempt 1 of 2  ·  Submitted: Jun 5, 2026 10:15 AM              │
│                                                                    │
│   [Review Answers]    [Try Again]    [← Back to Topic]            │
│                                                                    │
│   ─── Per-question Review (if enabled by teacher) ─────────────── │
│   Q1  ✓ Correct   C   Time: 0:52  Algebra · Easy                  │
│   Q2  ✗ Wrong     B → correct: D  Time: 1:10  [Show Explanation]  │
│   Q3  – Unanswered  (no answer shown)                              │
│   ...                                                              │
└────────────────────────────────────────────────────────────────────┘
```
- "Review Answers" only active if teacher enabled review
- Unanswered questions: show no correct answer (per RF-28 rule)
- Explanation visible: immediately / after finish / hidden — controlled by teacher setting per set
- "Try Again" always available (creates new attempt)

#### `STU-6` — Student History
```
Nav: Home | Content Map | History

My History                          [Filter: Section ▾] [Topic ▾] [Difficulty ▾]

┌─────────────────────────────────────────────────────────────────────────┐
│  DATE        PRACTICE SET              SCORE    TIME    ATTEMPT  STATUS  │
│  Jun 5       Linear Equations Easy #2  6/8 75%  8:42    #1       Done   │
│  Jun 3       Linear Equations Easy #1  9/10 90% 12:10   #2       Done   │
│  Jun 1       Craft & Structure Easy #1 6/8 75%  9:20    #1       Done   │
└─────────────────────────────────────────────────────────────────────────┘

Progress by Topic:
  Algebra           ████████░░  4 sets · Avg 82%
  Advanced Math     ████░░░░░░  1 set  · Avg 60%
  R&W               █████░░░░░  2 sets · Avg 75%
```
- Filters: Section (Math / R&W), Topic, Difficulty, Date range
- Click any row → STU-5 results detail
- Progress bars = average score across all attempts

---

### 2.3 Teacher Portal

#### `TEA-1` — Teacher Dashboard (Home)
```
┌── SAT Platform ──────────────────────────── [Teacher Name ▾] ────┐
│  Nav: Students | Content | Assignments | [⚙ Settings]            │
├───────────────────────────────────────────────────────────────────┤
│  Students                    [+ Add Student]  [Filter: Group ▾]  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ NAME         GROUP    LAST ACTIVE  PENDING  SCORE  STATUS   │  │
│  │ Ana Torres   Group A  Jun 5        2 sets   78%    Active   │  │
│  │ Luis Mora    Group A  Jun 3        1 set    65%  ⚠ 4d ago   │  │
│  │ Sofia Rea    Group B  Jun 4        0 sets   82%    Active   │  │
│  │ Carlos V.    Group B  —            3 sets   —    ⚠ Inactive │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Alerts:  ⚠ 2 students haven't practiced in 4+ days              │
│           ⚠ 1 assignment overdue                                  │
└───────────────────────────────────────────────────────────────────┘
```
- Alerts bar: inactivity (>3 days) + overdue assignments
- Click student row → TEA-2
- Filter by group/cycle

#### `TEA-2` — Student Detail
```
← Students  /  Ana Torres

[View as Student →]     [Edit Student]     [Deactivate]

┌─ Profile ─────────────────┐  ┌─ Summary ──────────────────────────┐
│ Name: Ana Torres           │  │ Sets completed: 14  Avg score: 78% │
│ Email: ana@...             │  │ Total practice time: 4h 12m        │
│ Phone: +51 ...             │  │ Last active: Jun 5, 2026           │
│ Start date: Apr 1, 2026    │  │ Active assignments: 2              │
│ Groups: Group A            │  └────────────────────────────────────┘
└────────────────────────────┘

─── Practice History ──────────────────────────────────────────────────
[Filter: Section ▾] [Topic ▾] [Difficulty ▾] [Date range ▾]

DATE     PRACTICE SET               SCORE   TIME   ATTEMPT  ACTIONS
Jun 5    Linear Equations Easy #2   6/8 75% 8:42    #1      [View] [Reopen] [Invalidate]
Jun 3    Linear Equations Easy #1   9/10 90% 12:10  #2      [View] [Reopen] [Invalidate]

─── Progress by Topic ─────────────────────────────────────────────────
Algebra        ████████░░  Avg 82%   4 sets completed
Advanced Math  ████░░░░░░  Avg 60%   1 set completed
R&W            █████░░░░░  Avg 75%   2 sets completed

─── Active Assignments ────────────────────────────────────────────────
Linear Equations Medium #1   Assigned Jun 3   Due Jun 10   Pending
```
- "View as Student" → Impersonation mode (RF-6)
- Reopen: unlocks a submitted attempt for the student
- Invalidate: marks attempt invalid (preserves in audit log)
- Teacher can add a comment on any attempt (Could Have RF-40)

#### `TEA-3` — Assign Practice Sets
```
← Students  /  Ana Torres  /  Assign

Assign Practice Sets to: Ana Torres  (or select: [Group A ▾] for bulk)

┌─ Section ──────────────────────────────────────────────────────────┐
│  ○ Mathematics    ○ Reading & Writing                              │
└────────────────────────────────────────────────────────────────────┘

┌─ Available Practice Sets ─────────────────────────────────── [Search] ─┐
│  ☐  Linear Equations Easy #3       Algebra · Easy       10 questions   │
│  ☐  Linear Equations Medium #1     Algebra · Medium      8 questions   │
│  ☑  Systems of Equations Easy #1   Algebra · Easy       10 questions   │
└────────────────────────────────────────────────────────────────────────┘

Options for selected sets:
  Due date: [ Jun 10 2026 ]   (optional)
  Explanation visibility: ( Immediately  ●  After finish  ○  Hidden ○ )
  Status on assign:  ● Unlocked   ○ Locked (unlock manually later)

[Assign Selected →]
```
- Works for individual student or full group (same form, target changes)
- Already-assigned sets show badge "Already assigned"
- Bulk assign to group → applies to all active students in group

#### `TEA-4` — Teacher Content Map (Overview)
```
Nav: Students | Content | Assignments | Settings

Content Map                              [+ Create Practice Set]

Mathematics
  Algebra
    Linear Equations    Easy: 3 sets (2 pub, 1 draft)  Med: 2 sets  Hard: 0 sets
    Systems of Equations Easy: 1 set  Med: 0 sets  Hard: 0 sets
    ...
  Advanced Math
    ...

Reading & Writing
  Information and Ideas   Easy: 2 sets  Med: 1 set  Hard: 0 sets
  ...

[Click topic row → TEA-5]
```

#### `TEA-5` — Practice Set List (per topic)
```
← Content  /  Algebra  /  Linear Equations  /  Easy

Practice Sets: Linear Equations · Easy                [+ New Practice Set]

┌──────────────────────────────────────────────────────────────────────┐
│ NAME                  QUESTIONS  STATUS    ASSIGNED TO  ACTIONS      │
│ Linear Eq. Easy #1    10         Published  5 students  [Edit][⋯]   │
│ Linear Eq. Easy #2    8          Published  3 students  [Edit][⋯]   │
│ Linear Eq. Easy #3    10         Draft      —           [Edit][⋯]   │
└──────────────────────────────────────────────────────────────────────┘

[⋯] menu: Publish | Archive | Assign | View attempts
```

#### `TEA-6` — Practice Set Editor
```
Practice Set: Linear Equations Easy #3      Status: [Draft ▾]

Name: ___________________________
Section: Mathematics   Domain: Algebra   Topic: Linear Equations
Difficulty: Easy

Explanation setting: ( Immediately  ○  After finish  ●  Hidden  ○ )

Questions  [+ Add Question]

  1.  [Question text preview...]   Easy   MC   [Edit] [↑] [↓] [✕]
  2.  [Question text preview...]   Easy   NI   [Edit] [↑] [↓] [✕]

[Save Draft]   [Publish]   [Discard]
```

#### `TEA-7` — Question Editor (create/edit question)
```
Question Editor                              [Save]  [Cancel]

Section:  ○ Math  ● R&W
Domain:   [Algebra ▾]
Topic:    [Linear Equations ▾]
Subskill: [________________________] (optional)
Difficulty: ○ Easy  ● Medium  ○ Hard
Type:     ● Multiple Choice (A/B/C/D)  ○ Numeric Input

── Stimulus / Passage (optional) ────────────────────────────────────
[Rich text editor with image upload + LaTeX support]

── Question Stem ────────────────────────────────────────────────────
[Rich text editor with image upload + LaTeX support]

── Answer Choices ───────────────────────────────────────────────────
  A) [_______________]   ● Correct
  B) [_______________]
  C) [_______________]
  D) [_______________]

── Explanation ──────────────────────────────────────────────────────
[Rich text editor]

Status: ○ Draft  ● Published
```
- For Numeric Input type: hide A/B/C/D, show numeric answer field
- LaTeX in any rich-text field rendered live via MathJax/KaTeX

#### `TEA-8` — Question Bank
```
Nav: Students | Content | Assignments | Settings → Question Bank

Question Bank                     [+ New Question]  [Bulk Import]

[Filter: Section ▾] [Domain ▾] [Topic ▾] [Difficulty ▾] [Status ▾] [Search...]

┌───────────────────────────────────────────────────────────────────────┐
│  ID    TOPIC             DIFFICULTY  TYPE  STATUS    USED IN  ACTIONS  │
│  Q-01  Linear Equations  Easy        MC    Published  3 sets  [Edit]  │
│  Q-02  Linear Equations  Easy        MC    Published  2 sets  [Edit]  │
│  Q-03  Craft & Structure Medium      MC    Draft      0 sets  [Edit]  │
└───────────────────────────────────────────────────────────────────────┘
```

#### `TEA-9` — Analytics / Student Response Detail
Accessed from TEA-2 → click a specific attempt result:
```
← Ana Torres  /  Linear Equations Easy #2  /  Attempt #1

Score: 6/8 · 75%  ·  Time: 8:42  ·  Jun 5, 2026

Q   ANSWER   CORRECT    TIME    STATUS    TOPIC/DIFF
1   C        C          0:52    ✓          Algebra · Easy
2   B        D          1:10    ✗         Algebra · Easy    [Show explanation]
3   —        —          0:30    – Blank   (no answer shown)
4   A        A          0:45    ✓          ...

Per-topic breakdown:
  Linear Equations  6/8  75%

[Reopen attempt]   [Invalidate attempt]   [Add comment]
```

#### `TEA-10` — Groups & Cycles Management
```
Settings → Groups & Cycles

Groups                              [+ New Group]

┌────────────────────────────────────────────────────────┐
│  Group A  ·  Morning  ·  4 active students  [Manage]  │
│  Group B  ·  Afternoon · 3 active students  [Manage]  │
└────────────────────────────────────────────────────────┘

[Manage Group A]
  Name: ____________   Schedule: ____________
  Students:  Ana Torres  ✕  |  Luis Mora  ✕  |  [+ Add student]
```

#### `TEA-11` — Impersonation Mode
```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠  You are viewing as: Ana Torres  [Exit Student View →]       │
└──────────────────────────────────────────────────────────────────┘
[Entire student UI renders below the banner — read-only, no actions]
```
- Persistent top banner while in impersonation mode
- Teacher cannot submit or modify anything; read-only view
- "Exit Student View" returns to TEA-2

---

### 2.4 Admin / Content Loader (same nav as Teacher in MVP)

In MVP, teacher account has admin content access. Screens TEA-6, TEA-7, TEA-8 cover content management. Bulk Import (TEA-8) is for the content loader to do initial migration:

#### `ADM-1` — Bulk Import
```
Bulk Import Questions

1. Download template  [Download CSV Template]
2. Fill in the template with question data
3. Upload file  [Choose file...]
4. Review imported questions before publishing
   [Preview & Validate →]
```
- Used internally by NordAI team for initial PDF content migration
- Validation step (TEA-7 style preview) before publish (RF-47)

---

## 3. Navigation Structure

```
/ ──── Login (AUTH-1)
      ├── /auth/forgot-password
      ├── /auth/activate/:token
      └── /auth/change-password

/student ──── Dashboard (STU-1)
         ├── /student/content-map          (STU-2)
         ├── /student/content-map/:topic/:difficulty  (STU-3)
         ├── /student/practice/:setId      (STU-4, player)
         ├── /student/results/:attemptId   (STU-5)
         └── /student/history             (STU-6)

/teacher ──── Dashboard (TEA-1)
         ├── /teacher/students/:id         (TEA-2)
         ├── /teacher/students/:id/assign  (TEA-3)
         ├── /teacher/students/:id/attempt/:attemptId  (TEA-9)
         ├── /teacher/content              (TEA-4)
         ├── /teacher/content/:topic/:difficulty  (TEA-5)
         ├── /teacher/practice-sets/:id/edit  (TEA-6)
         ├── /teacher/questions/:id/edit   (TEA-7)
         ├── /teacher/questions            (TEA-8)
         ├── /teacher/groups               (TEA-10)
         └── /teacher/impersonate/:studentId  (TEA-11)

/admin ──── Question Bank (TEA-8 reused)
       └── /admin/import  (ADM-1)
```

---

## 4. UI Design Principles

### Layout
- **Practice Set Player** (STU-4): strict two-column split (stimulus left, question/answers right). Both columns independently scrollable. Timer + progress bar pinned to top. Navigation controls pinned to bottom.
- **All other screens**: single-column or card-grid, max width ~1200px, centered.
- No mobile breakpoints (laptop + tablet only).

### Typography & Rendering
- Math formulas: KaTeX (preferred) or MathJax — renders inline and block LaTeX
- Reading passages: serif font for readability, min 16px
- Question stems and options: sans-serif, 15–16px
- Passage column: `overflow-y: auto; max-height: calc(100vh - 120px)`

### States & Feedback
- Autosave indicator: subtle "Saving..." → "Saved ✓" in top bar
- Lost connection: persistent banner "Connection lost — answers saved locally"
- Timer: green → yellow (<5 min) → red (<1 min)
- Locked content: grayed out with lock icon, no hover pointer

### Question Types
| Type | UI Component |
|------|-------------|
| Multiple Choice (A/B/C/D) | Radio buttons, large click area |
| Numeric Input (Math) | Single text input, validates numeric |
| Passage + MC (R&W) | Left: scrollable passage, Right: question + options |
| Image/Graph in stem | Inline img, zoom on click |
| Table | Responsive HTML table |

---

## 5. MVP Must-Have Screens Summary

| Screen | RF covered | Priority |
|--------|-----------|----------|
| AUTH-1 Login | RF-3 | Must Have |
| AUTH-2 Forgot Password | RF-3 | Must Have |
| AUTH-3 Invitation Activation | RF-2 | Must Have |
| STU-1 Student Dashboard | RF-7 | Must Have |
| STU-2 Content Map | RF-8, RF-9, RF-10 | Must Have |
| STU-3 Practice Sets List | RF-12 | Must Have |
| STU-4 Practice Set Player | RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25 | Must Have |
| STU-4b Question Navigator | RF-25 | Must Have |
| STU-5 Results | RF-28, RF-29, RF-30, RF-31 | Must Have |
| STU-6 History | RF-35 | Must Have |
| TEA-1 Teacher Dashboard | RF-4, RF-36, RF-39 | Must Have |
| TEA-2 Student Detail | RF-37, RF-38, RF-33 | Must Have |
| TEA-3 Assign Practice Sets | RF-13, RF-14, RF-15, RF-31 | Must Have |
| TEA-4 Content Map | RF-8, RF-9 | Must Have |
| TEA-5 Practice Sets List | RF-48 | Must Have |
| TEA-6 Practice Set Editor | RF-45, RF-48 | Must Have |
| TEA-7 Question Editor | RF-45 | Must Have |
| TEA-8 Question Bank | RF-45 | Must Have |
| TEA-9 Attempt Detail | RF-30, RF-38 | Must Have |
| TEA-10 Groups & Cycles | RF-5 | Must Have |
| TEA-11 Impersonation | RF-6 | Must Have |
| ADM-1 Bulk Import | RF-46 | Must Have |
| AUTH-4 Change Password | RF-3 | Must Have |
| Multiple attempts | RF-32 | Must Have |
| Attempt time tracking | RF-34 | Must Have |

---

## 6. Included Should-Have Scope

- Full Practice Tests (RF-49 to RF-55): assignable four-module tests, per-module timer, pause/continue, SAT-style RW/Math/Total scores, review path, and Desmos calculator in Math.
- Full Practice Test module model (RF-50)
- Full Practice Test per-module timer and overtime events (RF-51)
- Full Practice Test pause/resume across days (RF-52)
- SAT-style score conversion tables and 400-1600 total scoring (RF-53)
- Full Practice Test review by section/domain/topic/difficulty (RF-54)
- Admin-managed subskills for filtering/grouping questions (RF-11)
- Assignment due-state automation for pending / in-progress / completed / overdue (RF-18)
- Scheduled unlocks (RF-16)
- Unlock request by student (RF-17)
- Due date reminders / internal notifications (RF-41, RF-42)
- Individual reports and PDF export (RF-43, RF-44)
- Parent management and parent progress dashboard (RF-58, RF-59)

## 7. Deferred to Phase 2 (Could Have / Enhancements)

- Teacher comments on attempts (RF-40)
- Comparative analytics across students (RF-57)
- Theory/support materials area for students (RF-56)
- Mark for review + personal notes in player (RF-26)
- Visual elimination of answer choices (RF-27)
- Branding/logo customization (RNF-26)

## 8. Explicit Won't-Have Requirements

- Community, forums, streaks, XP, public rankings, daily questions, and social integrations are out of MVP scope (RF-60).
- Proctoring, webcam checks, forced fullscreen, tab blocking, and invasive anti-cheat controls are out of MVP scope (RF-61).
- User-facing Excel export is out of MVP scope; web views and PDF reports are the reporting direction (RF-62).

---

## 7. Open Questions for Prototype Validation (Week 4)

1. **Content Map depth**: Show subskills as a third level, or keep domain → topic as leaf?
2. **Practice Set Player timer**: Visible by default or collapsible? Teacher controls?
3. **Assignment flow**: Assign from Content Map or from Student profile? Both paths?
4. **Bulk group actions**: Can teacher lock/unlock a Practice Set for the whole group from the set list view?
5. **Attempt invalidation UX**: Soft delete with audit note, or requires a reason field?
