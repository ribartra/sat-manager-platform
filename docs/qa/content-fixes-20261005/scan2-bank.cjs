/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261005/<file>
const D=require("better-sqlite3");
const db=new D(process.cwd() + "/dev.db",{readonly:true});
const used=new Map();
for (const r of db.prepare(`select q.questionId id, t.name || ' · ' || m.name || ' #' || (q."order"+1) loc from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId`).all()) used.set(r.id,(used.get(r.id)||[]).concat(r.loc));
for (const r of db.prepare(`select psq.questionId id, ps.name || ' #' || (psq."order"+1) loc from PracticeSetQuestion psq join PracticeSet ps on ps.id=psq.practiceSetId where ps.status!='ARCHIVED'`).all()) used.set(r.id,(used.get(r.id)||[]).concat(r.loc));
const norm=s=>(s||"").replace(/\$|\\\(|\\\)|\\/g,"").replace(/[^a-z0-9]+/gi," ").trim().toLowerCase();
const out=[];
for (const q of db.prepare("select id, stem, stimulus, explanation, type from Question where status!='ARCHIVED'").all()) {
  if (!used.has(q.id)) continue;
  const where=used.get(q.id).join(" ; ");
  const o=db.prepare("select label,text from QuestionOption where questionId=? order by label").all(q.id);
  for (const [f,v] of [["stem",q.stem],["stimulus",q.stimulus],["explanation",q.explanation]]) {
    if (v && /^\s{0,3}#{1,6}\s/m.test(v)) out.push(["heading markdown #",where,f,q.id,v.match(/^\s{0,3}#{1,6}\s.*$/m)[0].slice(0,80)]);
    if (v && /\b(Test\s*\d+\s*(Innovator|Practice)|Math Module [12]|Reading and Writing Module [12])\b/i.test(v) && f!=="explanation") out.push(["cabecera de test/módulo",where,f,q.id,v.slice(0,90)]);
  }
  const sn=norm(q.stem);
  const hits=o.filter(x=>norm(x.text).length>12 && sn.includes(norm(x.text).slice(0,40))).length;
  if (o.length && hits>=2) out.push(["opciones repetidas dentro del enunciado",where,"stem",q.id,`${hits}/${o.length} opciones en el stem`]);
  if (q.stimulus && q.stem && norm(q.stem).length>120 && norm(q.stimulus).includes(norm(q.stem).slice(0,120))) out.push(["enunciado repite el pasaje",where,"stem",q.id,q.stem.slice(0,90)]);
  if (q.stimulus && q.stem && norm(q.stem).length<70 && norm(q.stimulus).startsWith(norm(q.stem)) && !/\?|_____|complete|which/i.test(q.stem)) out.push(["enunciado = título del pasaje (falta la pregunta)",where,"stem",q.id,q.stem]);
}
const by={}; for (const r of out) (by[r[0]]=by[r[0]]||[]).push(r);
for (const [k,v] of Object.entries(by)) { console.log(`\n## ${k} (${v.length})`); for (const r of v) console.log(`  ${r[1]} [${r[2]}] ${r[3]} :: ${String(r[4]).replace(/\s+/g," ")}`); }
