// Export the published FPT Math questions (+ options + ingest candidate link) for compare.py.
// Usage: node scripts/qa/fpt-math/export-db.cjs dev.db <outDir>
/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require("better-sqlite3");
const fs = require("node:fs");
const d = new Database(process.argv[2], { readonly: true });
const rows = d.prepare(`select t.name test,m.name module,fq."order" pos,q.id qid,q.type,q.correctAnswer ca,q.stem,q.stimulus,q.status
  from FullPracticeTest t join FullPracticeTestModule m on m.testId=t.id join FullPracticeTestQuestion fq on fq.moduleId=m.id
  join Question q on q.id=fq.questionId where m.section<>'MATH' order by t.name,m."order",fq."order"`).all();
const opt = d.prepare("select label,text,imageUrl from QuestionOption where questionId=? order by label");
const cand = d.prepare(`select c.questionNumber qn,c.moduleLabel ml,p.pageNumber page,f.relativePath fn from IngestQuestionCandidate c
  left join IngestPageArtifact p on p.id=c.pageArtifactId left join IngestSourceFile f on f.id=c.sourceFileId
  where c.officialQuestionId=? order by c.updatedAt desc`);
for (const r of rows) {
  r.options = opt.all(r.qid); r.cands = cand.all(r.qid); r.n = r.pos + 1;
  r.t = Number(r.test.replace(/\D/g, "")); r.m = r.module.includes("1") ? "1" : "2B";
}
fs.writeFileSync(`${process.argv[3]}/db.json`, JSON.stringify(rows));
console.log(rows.length, "questions");
