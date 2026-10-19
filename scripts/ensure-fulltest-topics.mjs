// Idempotent: ensure the Full Practice Test placeholder taxonomy exists.
//
// Mock exams need a Topic FK on Question. Classification for FT ítems is
// (test number, section Math/R&W, module M1/M2). Creates Domain "Full Practice
// Test" per section plus Topics named M1 and M2 (skills). Legacy section-only
// topics are kept for backward compatibility until backfill reassigns them.
//
// Usage: DATABASE_URL=file:./dev.db node scripts/ensure-fulltest-topics.mjs
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = url.startsWith("file:") ? url.slice(5) : url;
const db = new Database(dbPath);

const sections = db.prepare("SELECT id, name FROM Section").all();
const mathSection = sections.find((s) => s.name === "MATH");
const rwSection = sections.find((s) => s.name === "READING_WRITING"); // Test-only section (Practice uses READING / WRITING)
if (!mathSection || !rwSection) {
  console.error("Could not find MATH and READING_WRITING sections.", sections);
  process.exit(1);
}

const domains = [
  { domId: "dom-fulltest-math", domName: "Full Practice Test", sectionId: mathSection.id },
  { domId: "dom-fulltest-rw", domName: "Full Practice Test", sectionId: rwSection.id },
];

const topics = [
  // Legacy placeholders (do not delete — may still be referenced until backfill)
  { topId: "top-fulltest-math", topName: "Full Practice Test — Math", domId: "dom-fulltest-math" },
  { topId: "top-fulltest-rw", topName: "Full Practice Test — Reading & Writing", domId: "dom-fulltest-rw" },
  // Standardized module skills
  { topId: "top-fulltest-math-m1", topName: "M1", domId: "dom-fulltest-math" },
  { topId: "top-fulltest-math-m2", topName: "M2", domId: "dom-fulltest-math" },
  { topId: "top-fulltest-rw-m1", topName: "M1", domId: "dom-fulltest-rw" },
  { topId: "top-fulltest-rw-m2", topName: "M2", domId: "dom-fulltest-rw" },
];

const upsertDomain = db.prepare(
  "INSERT INTO Domain (id, name, sectionId, practiceArea) VALUES (?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, sectionId=excluded.sectionId, practiceArea=NULL",
);
const upsertTopic = db.prepare(
  "INSERT INTO Topic (id, name, domainId, taxonomyNodeId) VALUES (?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, domainId=excluded.domainId",
);

const tx = db.transaction(() => {
  for (const d of domains) {
    upsertDomain.run(d.domId, d.domName, d.sectionId);
  }
  for (const t of topics) {
    upsertTopic.run(t.topId, t.topName, t.domId);
  }
});
tx();

for (const t of topics) {
  const row = db
    .prepare(
      "SELECT t.id, t.name, s.name section FROM Topic t JOIN Domain d ON d.id=t.domainId JOIN Section s ON s.id=d.sectionId WHERE t.id=?",
    )
    .get(t.topId);
  console.log(`  ok: ${row.id} "${row.name}" [${row.section}]`);
}
db.close();
console.log("Full Practice Test placeholder topics ensured (M1/M2 + legacy).");
