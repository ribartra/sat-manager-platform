import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";

const DEFAULT_DATABASE_URL = "file:./dev.db";
const DEMO_QUESTION_ID = "cmsdhprnu001elit15beasdxb";
const DEMO_PRACTICE_SET_ID = "ai-sample-hard";
const DEMO_STUDENT_EMAILS = ["student1@sat.com", "student2@sat.com"];

type Row = Record<string, unknown>;

function sqlitePathFromDatabaseUrl(url: string) {
  if (!url.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function fail(message: string, details: string[] = []) {
  console.error(`DEMO_NOT_READY: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exitCode = 1;
}

function assertNoRawAnswerLeak(options: Row[]) {
  const leaked = options.filter((option) => /Correct Answer:|Rationale|Assessment Test/i.test(asString(option.text)));
  return leaked.map((option) => `${option.label}: ${asString(option.text).slice(0, 80)}`);
}

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const db = new Database(sqlitePathFromDatabaseUrl(databaseUrl), { readonly: true });

const question = db
  .prepare(
    `
      select q.id, q.stem, q.type, q.difficulty, q.correctAnswer, q.explanation, q.status,
             ps.id as practiceSetId, ps.name as practiceSetName, ps.status as practiceSetStatus,
             t.name as topicName,
             c.id as candidateId, c.promotionStatus, c.status as candidateStatus,
             sf.relativePath as sourceFilePath
        from Question q
        join IngestQuestionCandidate c on c.officialQuestionId = q.id
        join IngestSourceFile sf on sf.id = c.sourceFileId
        join PracticeSetQuestion psq on psq.questionId = q.id
        join PracticeSet ps on ps.id = psq.practiceSetId
        left join Topic t on t.id = ps.topicId
       where q.id = ?
    `,
  )
  .get(DEMO_QUESTION_ID) as Row | undefined;

if (!question) {
  fail("No existe la pregunta estrella de demo.", [
    `Ejecuta primero: npm run sample:promote`,
    `Pregunta esperada: ${DEMO_QUESTION_ID}`,
  ]);
  process.exit();
}

const options = db
  .prepare("select label, text, imageUrl from QuestionOption where questionId = ? order by label")
  .all(DEMO_QUESTION_ID) as Row[];

const assignments = db
  .prepare(
    `
      select u.email, u.name, a.status, a.locked, date(a.dueDate) as dueDate
        from Assignment a
        join User u on u.id = a.studentId
       where a.practiceSetId = ?
       order by u.email
    `,
  )
  .all(DEMO_PRACTICE_SET_ID) as Row[];

const missing: string[] = [];
if (question.practiceSetId !== DEMO_PRACTICE_SET_ID) missing.push(`Practice Set esperado: ${DEMO_PRACTICE_SET_ID}`);
if (question.practiceSetStatus !== "PUBLISHED") missing.push("El Practice Set debe estar publicado.");
if (question.status !== "PUBLISHED") missing.push("La pregunta debe estar publicada.");
if (question.type !== "MC") missing.push("La pregunta debe ser multiple choice.");
if (question.difficulty !== "HARD") missing.push("La pregunta debe quedar etiquetada como HARD.");
if (question.correctAnswer !== "C") missing.push("La respuesta correcta esperada es C.");
if (!asString(question.stem).includes("$a=c+d$")) missing.push("El enunciado no contiene el LaTeX esperado.");
if (options.length !== 4) missing.push(`Se esperaban 4 alternativas, se encontraron ${options.length}.`);
for (const label of ["A", "B", "C", "D"]) {
  if (!options.some((option) => option.label === label && asString(option.text).trim())) missing.push(`Falta alternativa ${label}.`);
}
for (const leak of assertNoRawAnswerLeak(options)) missing.push(`Alternativa contaminada con respuesta/rationale: ${leak}`);
for (const email of DEMO_STUDENT_EMAILS) {
  const assignment = assignments.find((item) => item.email === email);
  if (!assignment) missing.push(`Falta asignación para ${email}.`);
  else if (assignment.status !== "PENDING") missing.push(`La asignación de ${email} debe estar PENDING, está ${assignment.status}.`);
}

if (missing.length) {
  fail("El flujo cliente necesita corrección antes de demo.", missing);
  process.exit();
}

console.log("DEMO_READY");
console.log("");
console.log("Pregunta estrella");
console.log(`- ID oficial: ${question.id}`);
console.log(`- Practice Set: ${question.practiceSetName} (${question.practiceSetId})`);
console.log(`- Tema: ${question.topicName}`);
console.log(`- Origen: ${question.sourceFilePath}`);
console.log(`- Candidato IA: ${question.candidateId} (${question.candidateStatus}/${question.promotionStatus})`);
console.log("");
console.log("Enunciado");
console.log(asString(question.stem).replace(/\n+/g, " "));
console.log("");
console.log("Alternativas");
for (const option of options) console.log(`- ${option.label}: ${option.text}`);
console.log(`Respuesta correcta: ${question.correctAnswer}`);
console.log("");
console.log("Asignaciones");
for (const assignment of assignments) {
  console.log(`- ${assignment.name} <${assignment.email}>: ${assignment.status}, vence ${assignment.dueDate}`);
}
console.log("");
console.log("Flujo sugerido");
console.log("1. Admin: revisar origen en AI Import y confirmar candidato promovido.");
console.log("2. Teacher: abrir AI Sample Hard Practice Set y ver la pregunta publicada.");
console.log("3. Student: entrar como student1@sat.com / student123 y resolver el set asignado.");
