// Idempotent: ensure the Full Practice Test placeholder taxonomy exists.
//
// Mock exams (Full Practice Tests) carry no per-question skill — the only
// classification is (test number, section Math/R&W). But Question.topicId is a
// required FK, so full-test questions need a topic. This creates one placeholder
// Domain + Topic per section ("Full Practice Test") so those questions can be
// promoted while keeping the real academic taxonomy untouched. Run on any DB
// (dev or prod) before promoting full tests.
//
// Usage: DATABASE_URL=file:./dev.db node scripts/ensure-fulltest-topics.mjs
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = url.startsWith("file:") ? url.slice(5) : url;
const db = new Database(dbPath);

const sections = db.prepare("SELECT id, name FROM Section").all();
const mathSection = sections.find((s) => s.name === "MATH");
const rwSection = sections.find((s) => /READ|RW|WRIT/i.test(s.name));
if (!mathSection || !rwSection) {
  console.error("Could not find MATH and READING_WRITING sections.", sections);
  process.exit(1);
}

const rows = [
  { domId: "dom-fulltest-math", domName: "Full Practice Test", sectionId: mathSection.id, topId: "top-fulltest-math", topName: "Full Practice Test — Math" },
  { domId: "dom-fulltest-rw", domName: "Full Practice Test", sectionId: rwSection.id, topId: "top-fulltest-rw", topName: "Full Practice Test — Reading & Writing" },
];

const upsertDomain = db.prepare("INSERT INTO Domain (id, name, sectionId) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, sectionId=excluded.sectionId");
const upsertTopic = db.prepare("INSERT INTO Topic (id, name, domainId, taxonomyNodeId) VALUES (?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, domainId=excluded.domainId");

const tx = db.transaction(() => {
  for (const r of rows) {
    upsertDomain.run(r.domId, r.domName, r.sectionId);
    upsertTopic.run(r.topId, r.topName, r.domId);
  }
});
tx();

for (const r of rows) {
  const t = db.prepare("SELECT t.id, t.name, s.name section FROM Topic t JOIN Domain d ON d.id=t.domainId JOIN Section s ON s.id=d.sectionId WHERE t.id=?").get(r.topId);
  console.log(`  ok: ${t.id} "${t.name}" [${t.section}]`);
}
db.close();
console.log("Full Practice Test placeholder topics ensured.");
