# Diagrama de clases (Entity Relationship) — Plataforma SAT · eraser.io

Diagrama del modelo de datos en sintaxis **Entity Relationship Diagram** de
[eraser.io](https://app.eraser.io) (diagram-as-code). Para usarlo:

1. Abre eraser.io → **New Diagram** → **Entity Relationship Diagram**.
2. Copia íntegro el bloque de código en el panel de código.
3. El diagrama se renderiza con los colores por dominio.

> Sintaxis ER de eraser: cada columna es `nombre tipo` y solo `pk` como anotador.
> Las FKs se expresan en la sección de **relaciones**, no en la columna.
> Cardinalidad: `-` 1:1 · `<` 1:N · `>` N:1 · `<>` N:M.
> Los valores de enum/estado van en la **tabla de referencia** al final (no caben inline en ER).

---

## Código eraser.io

```eraser
// =========================================================
//  PLATAFORMA SAT — Modelo de datos (Prisma schema)
//  Cardinalidad: -  1:1  |  <  1:N  |  >  N:1  |  <>  N:M
// =========================================================

// ---------- 1. Identidad y acceso ----------
User [icon: user, color: blue] {
  id string pk
  name string
  email string
  phone string
  passwordHash string
  role string
  active boolean
  validationStatus string
  validationReviewedById string
  avatarUrl string
  birthDate datetime
  startDate datetime
  lastActiveAt datetime
  createdAt datetime
  updatedAt datetime
}

InviteToken [icon: mail, color: blue] {
  id string pk
  role string
  email string
  name string
  invitedById string
  programId string
  isMinor boolean
  parentEmail string
  linkedStudentEmail string
  parentConsentToken string
  parentConsentAt datetime
  parentConsentIp string
  token string
  expiresAt datetime
  usedAt datetime
}

PasswordResetToken [icon: key, color: blue] {
  id string pk
  userId string
  token string
  expiresAt datetime
  usedAt datetime
}

ParentStudent [icon: users, color: blue] {
  parentId string pk
  studentId string pk
  authorizedAt datetime
}

// ---------- 2. Programas y grupos ----------
Program [icon: book, color: green] {
  id string pk
  name string
  startDate datetime
  endDate datetime
  active boolean
  deletedAt datetime
  createdAt datetime
  updatedAt datetime
}

ProgramTeacher [icon: link, color: green] {
  programId string pk
  teacherId string pk
  startDate datetime
  endDate datetime
}

ProgramEnrollment [icon: user-check, color: green] {
  programId string pk
  studentId string pk
  enrolledAt datetime
  status string
  active boolean
  parentApprovalStatus string
  parentApprovedAt datetime
}

Group [icon: grid, color: green] {
  id string pk
  name string
  schedule string
  createdAt datetime
}

GroupMembership [icon: link, color: green] {
  userId string pk
  groupId string pk
}

// ---------- 3. Taxonomía y banco de preguntas ----------
Section [icon: layers, color: orange] {
  id string pk
  name string
  label string
}

Domain [icon: layers, color: orange] {
  id string pk
  name string
  sectionId string
}

Topic [icon: tag, color: orange] {
  id string pk
  name string
  domainId string
}

Subskill [icon: tag, color: orange] {
  id string pk
  name string
  topicId string
}

Question [icon: help-circle, color: orange] {
  id string pk
  stem string
  stimulus string
  type string
  difficulty string
  correctAnswer string
  explanation string
  status string
  imageUrl string
  supportsGraph boolean
  topicId string
  subskillId string
  createdAt datetime
  updatedAt datetime
}

QuestionOption [icon: list, color: orange] {
  id string pk
  questionId string
  label string
  text string
}

// ---------- 4. Practice Sets y asignaciones ----------
PracticeSet [icon: clipboard, color: purple] {
  id string pk
  name string
  topicId string
  difficulty string
  status string
  explanationVisibility string
  createdAt datetime
  updatedAt datetime
}

PracticeSetQuestion [icon: link, color: purple] {
  practiceSetId string pk
  questionId string pk
  order int
}

Assignment [icon: send, color: purple] {
  id string pk
  practiceSetId string
  studentId string
  assignedById string
  dueDate datetime
  unlockAt datetime
  locked boolean
  status string
  createdAt datetime
}

UnlockRequest [icon: unlock, color: purple] {
  id string pk
  assignmentId string
  studentId string
  status string
  createdAt datetime
  resolvedAt datetime
}

// ---------- 5. Intentos, respuestas y snapshots ----------
Attempt [icon: edit, color: red] {
  id string pk
  assignmentId string
  studentId string
  practiceSetId string
  practiceSetSnapshot json
  attemptNumber int
  startedAt datetime
  submittedAt datetime
  totalTime int
  status string
  currentQuestion int
  teacherComment string
}

AttemptAnswer [icon: check-square, color: red] {
  id string pk
  attemptId string
  questionId string
  questionSnapshot json
  answer string
  isCorrect boolean
  timeSpent int
  markedForReview boolean
  note string
  eliminatedOptions json
}

// ---------- 6. Notificaciones y auditoría ----------
Notification [icon: bell, color: gray] {
  id string pk
  userId string
  title string
  body string
  href string
  readAt datetime
  createdAt datetime
}

AuditLog [icon: shield, color: gray] {
  id string pk
  userId string
  action string
  targetType string
  targetId string
  metadata json
  createdAt datetime
}

// ---------- 7. Full Practice Tests (extensión adelantada) ----------
FullPracticeTest [icon: file-text, color: teal] {
  id string pk
  name string
  status string
  reviewEnabled boolean
  createdAt datetime
  updatedAt datetime
}

FullPracticeTestModule [icon: columns, color: teal] {
  id string pk
  testId string
  name string
  section string
  order int
  timeLimit int
}

FullPracticeTestQuestion [icon: link, color: teal] {
  moduleId string pk
  questionId string pk
  order int
}

FullPracticeTestAssignment [icon: send, color: teal] {
  id string pk
  testId string
  studentId string
  assignedById string
  dueDate datetime
  status string
  createdAt datetime
}

FullPracticeTestAttempt [icon: edit, color: teal] {
  id string pk
  testId string
  assignmentId string
  studentId string
  startedAt datetime
  submittedAt datetime
  status string
  currentModule int
  currentQuestion int
  moduleTimerState json
  rwScore int
  mathScore int
  totalScore int
  timeExpiredEvents int
  extraTimeUsed int
}

FullPracticeTestAnswer [icon: check-square, color: teal] {
  id string pk
  attemptId string
  moduleId string
  questionId string
  answer string
  isCorrect boolean
  timeSpent int
}

FullPracticeTestScoreConversion [icon: trending-up, color: teal] {
  id string pk
  section string
  rawCorrect int
  score int
}

// ---------- 8. Materiales ----------
StudyMaterial [icon: folder, color: yellow] {
  id string pk
  title string
  description string
  body string
  url string
  topicId string
  status string
  createdById string
  createdAt datetime
  updatedAt datetime
}

// =========================================================
//  RELACIONES
// =========================================================

// --- Identidad y acceso ---
User.id < PasswordResetToken.userId
User.id < ParentStudent.parentId
User.id < ParentStudent.studentId
User.id < Notification.userId
User.id < AuditLog.userId

// --- Programas y grupos (N:M vía puentes) ---
Program.id < ProgramTeacher.programId
User.id < ProgramTeacher.teacherId
Program.id < ProgramEnrollment.programId
User.id < ProgramEnrollment.studentId
Program.id < InviteToken.programId
Group.id < GroupMembership.groupId
User.id < GroupMembership.userId

// --- Taxonomía y banco ---
Section.id < Domain.sectionId
Domain.id < Topic.domainId
Topic.id < Subskill.topicId
Topic.id < Question.topicId
Subskill.id < Question.subskillId
Question.id < QuestionOption.questionId

// --- Practice Sets y asignaciones ---
Topic.id < PracticeSet.topicId
PracticeSet.id < PracticeSetQuestion.practiceSetId
Question.id < PracticeSetQuestion.questionId
PracticeSet.id < Assignment.practiceSetId
User.id < Assignment.studentId
User.id < Assignment.assignedById
Assignment.id < UnlockRequest.assignmentId

// --- Intentos y respuestas ---
Assignment.id < Attempt.assignmentId
PracticeSet.id < Attempt.practiceSetId
User.id < Attempt.studentId
Attempt.id < AttemptAnswer.attemptId
Question.id < AttemptAnswer.questionId

// --- Full Practice Tests ---
FullPracticeTest.id < FullPracticeTestModule.testId
FullPracticeTestModule.id < FullPracticeTestQuestion.moduleId
Question.id < FullPracticeTestQuestion.questionId
FullPracticeTest.id < FullPracticeTestAssignment.testId
User.id < FullPracticeTestAssignment.studentId
FullPracticeTest.id < FullPracticeTestAttempt.testId
FullPracticeTestAssignment.id < FullPracticeTestAttempt.assignmentId
User.id < FullPracticeTestAttempt.studentId
FullPracticeTestAttempt.id < FullPracticeTestAnswer.attemptId

// --- Materiales ---
Topic.id < StudyMaterial.topicId
```

---

## Referencia de enums y estados

La sintaxis ER de eraser no admite anotar valores de enum en la columna; aquí el detalle
de cada campo codificado como `string`:

| Entidad.campo | Valores |
|---|---|
| `User.role` | `STUDENT`, `TEACHER`, `ADMIN`, `PARENT` |
| `User.validationStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `InviteToken.role` | `STUDENT`, `PARENT` |
| `ProgramEnrollment.status` | `PENDING`, `APPROVED`, `REJECTED` |
| `ProgramEnrollment.parentApprovalStatus` | `null`, `PENDING`, `APPROVED`, `REJECTED` |
| `Question.type` | `MC`, `NUMERIC` |
| `Question.difficulty` / `PracticeSet.difficulty` | `EASY`, `MEDIUM`, `HARD` |
| `Question.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `QuestionOption.label` | `A`, `B`, `C`, `D` |
| `PracticeSet.status` | `DRAFT`, `PUBLISHED`, `BLOCKED`, `ARCHIVED` |
| `PracticeSet.explanationVisibility` | `IMMEDIATE`, `AFTER_FINISH`, `HIDDEN` |
| `Assignment.status` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE` |
| `Attempt.status` | `IN_PROGRESS`, `SUBMITTED`, `INVALIDATED` |
| `UnlockRequest.status` | `PENDING`, `APPROVED`, `DENIED` |
| `FullPracticeTest.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `FullPracticeTestModule.section` / `…ScoreConversion.section` | `RW`, `MATH` |
| `FullPracticeTestAttempt.status` | `IN_PROGRESS`, `SUBMITTED` |
| `StudyMaterial.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |

Campos únicos (constraint `@unique` en Prisma, no expresable en ER): `User.email`,
`Section.name`, `InviteToken.token`, `InviteToken.parentConsentToken`,
`PasswordResetToken.token`. Únicos compuestos: `AttemptAnswer(attemptId, questionId)`,
`FullPracticeTestAnswer(attemptId, questionId)`,
`FullPracticeTestScoreConversion(section, rawCorrect)`.

---

## Notas de lectura del diagrama

- **Centralidad de `User`:** participa en programas, grupos, asignaciones, intentos,
  vínculos padre-hijo, notificaciones y auditoría. Todos los roles conviven en una tabla.
- **Tablas puente N:M** (ícono `link`): `ProgramTeacher`, `ProgramEnrollment`,
  `GroupMembership`, `PracticeSetQuestion`, `ParentStudent`, `FullPracticeTestQuestion`.
  Cargan atributos (orden, vigencia, estado), por eso son entidades y no conectores.
- **Reutilización del banco:** `Question` alimenta `PracticeSetQuestion` y
  `FullPracticeTestQuestion`; Full Practice Tests no duplican el banco.
- **Snapshots:** `Attempt.practiceSetSnapshot` y `AttemptAnswer.questionSnapshot` son
  campos JSON embebidos (no relaciones); congelan la versión histórica del contenido.
- **Referencias blandas sin FK** en Prisma (`User.validationReviewedById`,
  `InviteToken.invitedById`, `StudyMaterial.createdById`): se muestran como atributos,
  no como relaciones.
```
