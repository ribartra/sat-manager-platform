import { readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function assertSourcePatterns() {
  const checks = [
    {
      file: "lib/practice-area.ts",
      requires: ["PRACTICE_AREA_TABS", "practiceAreaDomainWhere", "Form, Structure & Sense"],
      label: "practice-area helpers canónicos",
    },
    {
      file: "lib/practice-area.ts",
      forbids: ["DOMAIN_NAMES", "inferPracticeAreaFromNames"],
      label: "Sin reglas por nombre de dominio: el área sale de la Section",
    },
    {
      file: "components/sat/practice-area-tabs.tsx",
      requires: ["AREA_TABS_WITH_TESTS", "buildAreaHref", "includeSummary"],
      label: "tabs compartidos Summary/Math/Reading/Writing/Tests",
    },
    {
      file: "lib/practice-area.ts",
      requires: ['export const TESTS_LABEL = "Tests"', 'key: "tests" as const, label: TESTS_LABEL', 'if (value === "mocks") return "tests"'],
      label: "Pestaña Tests a la derecha (key tests; alias legacy mocks)",
    },
    {
      file: "app/(teacher)/teacher/analytics/page.tsx",
      requires: ["studentAccessWhereFor", "#performance", "redirect"],
      label: "Analytics redirige a la seccion de desempeno del alumno (misma area y filtros)",
    },
    {
      file: "app/(student)/student/history/page.tsx",
      requires: ["PRACTICE_AREA_TABS", '"tests"', "<HistoryTable"],
      label: "History sin Section redundante y con Tests",
    },
    {
      file: "app/(teacher)/teacher/students/[studentId]/report/page.tsx",
      requires: ["#performance", "redirect", "progressFiltersFromParams"],
      label: "Report individual redirige a la pagina del alumno conservando filtros",
    },
    {
      file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
      requires: ["PracticeAreaTabs", "practiceAreaFromTab", "loadMockReport", "activeAreaTab"],
      label: "View Student con 4 tabs y filtro por área",
    },
    {
      file: "app/(teacher)/teacher/impersonate/[studentId]/page.tsx",
      requires: ["StudentHome", "teacherViewLinks", "studentAccessWhereFor", "IMPERSONATE_STUDENT_VIEW"],
      label: "Student view = Home real del alumno (solo lectura), con alcance de programa y auditoria",
    },
    {
      file: "app/(student)/student/student-home.tsx",
      requires: ["practiceArea", "<ViewSummaryCard", 'title="Tests"', 'title="Practice"'],
      label: "Student Home: practica por area y Tests en recuadros separados",
    },
    {
      file: "lib/pdf/build-student-report.ts",
      requires: ["PRACTICE_AREA", 'mocks: "Tests"', "loadPracticeReport", "loadMockReport"],
      label: "PDF separa Practice areas y Tests (una seccion por area)",
    },
    {
      file: "prisma/seed-taxonomy.ts",
      requires: ["SAT_TAXONOMY", "practiceArea: ref.section", "skillOrder"],
      label: "Seed sigue la taxonomia de referencia (lib/taxonomy-reference.ts)",
    },
    {
      file: "lib/app-settings.ts",
      requires: ["FPT_PRETEST_EXCLUSION", "Exclude Test pretest", "defaultValue: false"],
      label: "Feature flag FPT_PRETEST_EXCLUSION default off",
    },
  ];

  for (const check of checks) {
    const content = await readFile(path.join(root, check.file), "utf8");
    const missing = (check.requires ?? []).filter((token) => !content.includes(token));
    const present = (check.forbids ?? []).filter((token) => content.includes(token));
    if (missing.length) {
      fail(`${check.label}: falta ${missing.join(", ")} en ${check.file}`);
    } else if (present.length) {
      fail(`${check.label}: no debe contener ${present.join(", ")} en ${check.file}`);
    } else {
      ok(check.label);
    }
  }

  const history = await readFile(path.join(root, "app/(student)/student/history/page.tsx"), "utf8");
  if (history.includes("name=\"section\"") || history.includes(">Section<")) {
    fail("History aún expone filtro Section redundante");
  } else {
    ok("History sin filtro Section");
  }
}

function assertDatabaseConsistency() {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePath = dbUrl.replace(/^file:/, "");
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  // In CI dev.db is a Git LFS pointer (text), not a database: better-sqlite3 only fails at the first
  // query, so check the SQLite header first and skip the DB asserts like a missing file.
  let isSqlite = false;
  try {
    const fd = fs.openSync(absolute, "r");
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    isSqlite = header.toString("latin1") === "SQLite format 3\0";
  } catch {
    isSqlite = false;
  }
  if (!isSqlite) {
    console.warn(`⚠ ${absolute} no es una base SQLite (¿puntero LFS?); se omiten asserts de BD`);
    return;
  }
  let db;
  try {
    db = new Database(absolute, { readonly: true, fileMustExist: true });
  } catch {
    console.warn(`⚠ No se pudo abrir ${absolute}; se omiten asserts de BD`);
    return;
  }

  try {
    const columns = db.prepare(`PRAGMA table_info("Domain")`).all();
    if (!columns.some((col) => col.name === "practiceArea")) {
      fail("Domain.practiceArea no existe en la BD");
      return;
    }
    ok("Domain.practiceArea presente");

    const missing = db
      .prepare(
        `SELECT id, name FROM Domain
         WHERE name != 'Full Practice Test'
           AND (practiceArea IS NULL OR practiceArea NOT IN ('MATH','READING','WRITING'))`
      )
      .all();
    if (missing.length) {
      fail(`Domains académicos sin practiceArea válido: ${missing.map((d) => d.name).join(", ")}`);
    } else {
      ok("Todos los domains académicos tienen practiceArea");
    }

    const sections = db.prepare(`SELECT name, label FROM Section ORDER BY name`).all();
    const want = { MATH: "Math", READING: "Reading", WRITING: "Writing", READING_WRITING: "Reading & Writing" };
    const badSections = Object.entries(want).filter(([name, label]) => !sections.some((s) => s.name === name && s.label === label));
    if (badSections.length) {
      fail(`Sections oficiales faltantes o con label distinto: ${badSections.map(([n]) => n).join(", ")}`);
    } else {
      ok("Sections oficiales: Math, Reading, Writing (+ Reading & Writing solo Tests)");
    }

    const desync = db
      .prepare(
        `SELECT d.name, d.practiceArea, s.name AS section FROM Domain d JOIN Section s ON s.id = d.sectionId
         WHERE (d.practiceArea IS NOT NULL AND d.practiceArea <> s.name)
            OR (d.practiceArea IS NULL AND d.name <> 'Full Practice Test')
            OR (s.name = 'READING_WRITING' AND d.name <> 'Full Practice Test')`
      )
      .all();
    if (desync.length) {
      fail(`Domains con practiceArea distinto de su Section: ${desync.map((d) => `${d.name} (${d.practiceArea}/${d.section})`).join(", ")}`);
    } else {
      ok("Domain.practiceArea = Section en todos los domains");
    }

    const triggers = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'Domain_practiceArea_matches_section%'`).all();
    if (triggers.length < 2) {
      fail("Faltan los triggers que mantienen Domain.practiceArea = Section");
    } else {
      ok("Triggers practiceArea = Section presentes");
    }

    const boundaries = db
      .prepare(
        `SELECT t.name AS topic, d.name AS domain, d.practiceArea AS area
         FROM Topic t
         JOIN Domain d ON d.id = t.domainId
         WHERE t.name = 'Boundaries'`
      )
      .all();
    if (!boundaries.length) {
      fail("Topic Boundaries no encontrado");
    } else if (boundaries.some((row) => row.area !== "WRITING")) {
      fail(`Boundaries debe ser WRITING; got ${boundaries.map((r) => r.area).join(",")}`);
    } else {
      ok("Boundaries bajo Writing");
    }

    const grammar = db
      .prepare(`SELECT name FROM Topic WHERE id = 'top-fss' AND name = 'Form, Structure & Sense'`)
      .all();
    const legacy = db
      .prepare(`SELECT name FROM Topic WHERE name IN ('Form, Structure, and Sense', 'Grammar and Structure')`)
      .all();
    if (!grammar.length) {
      fail("Form, Structure & Sense no encontrado");
    } else {
      ok("Form, Structure & Sense presente");
    }
    if (legacy.length) {
      fail("Todavía existe un nombre antiguo de Form, Structure & Sense");
    } else {
      ok("Nombres antiguos de Form, Structure & Sense renombrados");
    }

    // Reference taxonomy (Taxonomia-SAT.md): 29 practice skills, no legacy skills left.
    const practiceSkills = db.prepare(`SELECT COUNT(*) AS n FROM Topic t JOIN Domain d ON d.id = t.domainId WHERE d.practiceArea IS NOT NULL`).get().n;
    const removed = db.prepare(`SELECT COUNT(*) AS n FROM Topic WHERE id IN ('top-lineq','top-syseq','top-ineq','top-quadfn','top-poly','top-expfn','top-radeq','top-ratprop','top-stats','top-tri','top-trig','top-vol','top-central','top-textev','top-texstr','top-authpur')`).get().n;
    if (practiceSkills !== 29 || removed) fail(`Taxonomia de referencia: ${practiceSkills} skills de practica (esperado 29), ${removed} legacy`);
    else ok("Taxonomia de referencia: 29 skills, sin legacy");

    // Domain ↔ Skill correspondence table (TaxonomyAlias): PDF spellings as aliases of the md names.
    const grammarAlias = db.prepare(`SELECT COUNT(*) AS n FROM TaxonomyAlias WHERE kind = 'SKILL' AND alias = 'Grammar' AND topicId = 'top-fss'`).get().n;
    const pdfAliases = db.prepare(`SELECT COUNT(*) AS n FROM TaxonomyAlias WHERE source = 'PDF'`).get().n;
    // Sets per skill and level are 0..N (lifecycle: new skills start empty, sets get archived), so empty
    // levels are reported, never a failure.
    const emptyLevels = db.prepare(`SELECT COUNT(*) AS n FROM Topic t JOIN Domain d ON d.id = t.domainId
      CROSS JOIN (SELECT 'EASY' AS d UNION ALL SELECT 'MEDIUM' UNION ALL SELECT 'HARD') l
      WHERE d.practiceArea IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PracticeSet p WHERE p.topicId = t.id AND p.difficulty = l.d)`).get().n;
    ok(`Sets por skill y nivel: 0..N (${emptyLevels} niveles sin sets)`);
    if (!grammarAlias || pdfAliases < 5) fail(`Correspondencia: alias Grammar=${grammarAlias}, alias PDF=${pdfAliases} (esperado >=5)`);
    else ok(`Correspondencia Domain ↔ Skill con alias del PDF (${pdfAliases})`);

    const dual = db
      .prepare(
        `SELECT t.name, COUNT(DISTINCT d.practiceArea) AS areas
         FROM Topic t
         JOIN Domain d ON d.id = t.domainId
         WHERE d.practiceArea IS NOT NULL
         GROUP BY t.name
         HAVING areas > 1`
      )
      .all();
    if (dual.length) {
      fail(`Topics con más de un practiceArea: ${dual.map((t) => t.name).join(", ")}`);
    } else {
      ok("Ningún topic Practice en dos áreas");
    }
  } finally {
    db.close();
  }
}

await assertSourcePatterns();
assertDatabaseConsistency();

if (process.exitCode) {
  console.error("\nqa:practice-area FAILED");
  process.exit(1);
}
console.log("\nqa:practice-area OK");
