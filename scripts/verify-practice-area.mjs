import { readFile } from "node:fs/promises";
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
      requires: ["PRACTICE_AREA_TABS", "practiceAreaDomainWhere", "Grammar and Structure"],
      label: "practice-area helpers canónicos",
    },
    {
      file: "components/sat/practice-area-tabs.tsx",
      requires: ["AREA_TABS_WITH_MOCKS", "buildAreaHref"],
      label: "tabs compartidos Math/Reading/Writing/Full Practice Tests",
    },
    {
      file: "lib/practice-area.ts",
      requires: ['label: "Full Practice Tests"', 'key: "mocks"'],
      label: "4ª pestaña Full Practice Tests (key mocks)",
    },
    {
      file: "app/(teacher)/teacher/analytics/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", "mocks", "Roster-wide signal"],
      label: "Analytics filtra por practiceArea",
    },
    {
      file: "app/(student)/student/history/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", 'area === "mocks"'],
      label: "History sin Section redundante y con Full Practice Tests",
    },
    {
      file: "app/(teacher)/teacher/students/[studentId]/report/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", "attempt", "Full Practice Tests"],
      label: "Report individual con tabs y conteo de attempts",
    },
    {
      file: "app/(teacher)/teacher/students/[studentId]/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", 'area === "mocks"', "activeAreaTab"],
      label: "View Student con 4 tabs y filtro por área",
    },
    {
      file: "app/(teacher)/teacher/impersonate/[studentId]/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", 'area === "mocks"', "activeAreaTab"],
      label: "Impersonate Assigned con 4 tabs",
    },
    {
      file: "app/(student)/student/page.tsx",
      requires: ["PracticeAreaTabs", "practiceArea", 'area === "mocks"', "activeAreaTab"],
      label: "Student Home con 4 tabs y filtro por área",
    },
    {
      file: "app/api/reports/students/[studentId]/pdf/route.ts",
      requires: ["practiceAreaFromReportArea", "Full Practice Tests", "attempt"],
      label: "PDF separa Practice areas y Full Practice Tests",
    },
    {
      file: "prisma/seed-taxonomy.ts",
      requires: ['practiceArea: "MATH"', 'practiceArea: "READING"', 'practiceArea: "WRITING"', "Grammar and Structure"],
      label: "Seed persiste practiceArea y Grammar and Structure",
    },
    {
      file: "lib/app-settings.ts",
      requires: ["FPT_PRETEST_EXCLUSION", "Exclude Full Practice Test pretest", "defaultValue: false"],
      label: "Feature flag FPT_PRETEST_EXCLUSION default off",
    },
  ];

  for (const check of checks) {
    const content = await readFile(path.join(root, check.file), "utf8");
    const missing = check.requires.filter((token) => !content.includes(token));
    if (missing.length) {
      fail(`${check.label}: falta ${missing.join(", ")} en ${check.file}`);
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
      .prepare(`SELECT name FROM Topic WHERE name = 'Grammar and Structure' OR id = 'top-fss'`)
      .all();
    const legacy = db
      .prepare(`SELECT name FROM Topic WHERE name = 'Form, Structure, and Sense'`)
      .all();
    if (!grammar.length) {
      fail("Grammar and Structure no encontrado");
    } else {
      ok("Grammar and Structure presente");
    }
    if (legacy.length) {
      fail("Todavía existe Form, Structure, and Sense");
    } else {
      ok("Legacy Form, Structure, and Sense renombrado");
    }

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
