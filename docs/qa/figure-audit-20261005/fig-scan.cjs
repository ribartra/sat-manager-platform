/* eslint-disable @typescript-eslint/no-require-imports */ // node docs/qa/figure-audit-20261005/fig-scan.cjs <db> <out.json>
// Read-only: questions whose text refers to a visual (graph/table/figure/...) but have no image.
const D=require(process.env.BSQ||"better-sqlite3");const db=new D(process.argv[2],{readonly:true});
const used=new Map();
for (const r of db.prepare(`select q.questionId id, t.name || ' · ' || m.name || ' #' || (q."order"+1) loc, 'FPT' kind from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId`).all()) used.set(r.id,{loc:r.loc,kind:r.kind});
for (const r of db.prepare(`select psq.questionId id, ps.name || ' #' || (psq."order"+1) loc, 'PS' kind, ps.status st from PracticeSetQuestion psq join PracticeSet ps on ps.id=psq.practiceSetId where ps.status!='ARCHIVED'`).all()) if(!used.has(r.id)) used.set(r.id,{loc:r.loc,kind:r.kind});
const VIS=/\b(graph(?:ed|s)?|table|tables|figure|figures|diagram|chart|scatterplot|scatter plot|histogram|dot plot|box plot|boxplot|bar graph|line graph|pie chart|map|shaded region|shown below|shown above|is shown|are shown|as shown|the image|pictured|grid)\b/i;
const out=[];
for (const q of db.prepare("select id, status, stem, stimulus, explanation, imageUrl, supportsGraph, type from Question where status!='ARCHIVED'").all()) {
  if (!used.has(q.id)) continue;
  const opts=db.prepare("select label,text,imageUrl from QuestionOption where questionId=?").all(q.id);
  const text=[q.stem,q.stimulus].filter(Boolean).join("\n");
  const m=text.match(VIS); if(!m) continue;
  const hasQImg=!!q.imageUrl, hasOptImg=opts.some(o=>o.imageUrl);
  const inlineTable=/\n\s*\|.+\|\s*\n|<table|\\begin\{(array|tabular)\}/i.test(text);
  if (hasQImg || hasOptImg) continue;
  out.push({id:q.id,status:q.status,loc:used.get(q.id).loc,kind:used.get(q.id).kind,term:m[0],inlineTable,supportsGraph:q.supportsGraph,ctx:text.slice(Math.max(0,m.index-70),m.index+70).replace(/\s+/g," ")});
}
require("fs").writeFileSync(process.argv[3],JSON.stringify(out,null,1));
const by={}; for (const o of out){ const k=o.term.toLowerCase()+(o.inlineTable?" [tabla en texto]":""); by[k]=(by[k]||0)+1; }
console.log("in-use questions:",used.size,"mention visual w/o any image:",out.length); console.log(by);
