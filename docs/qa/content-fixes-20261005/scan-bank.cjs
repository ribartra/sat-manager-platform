const D=require("/home/turista/Descargas/Github/sat-manager-platform/node_modules/better-sqlite3");
const fs=require("fs"),path=require("path");
const ROOT="/home/turista/Descargas/Github/sat-manager-platform";
const db=new D(ROOT+"/dev.db",{readonly:true});
// where each question is used
const used=new Map();
for (const r of db.prepare(`select q.questionId id, t.name || ' · ' || m.name || ' #' || (q."order"+1) loc from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId`).all()) used.set(r.id,(used.get(r.id)||[]).concat(r.loc));
for (const r of db.prepare(`select psq.questionId id, ps.name || ' #' || (psq."order"+1) loc from PracticeSetQuestion psq join PracticeSet ps on ps.id=psq.practiceSetId where ps.status!='ARCHIVED'`).all()) used.set(r.id,(used.get(r.id)||[]).concat(r.loc));
const qs=db.prepare("select id, stem, stimulus, type, correctAnswer, explanation, imageUrl, status from Question where status!='ARCHIVED'").all();
const opts=db.prepare("select questionId, label, text, imageUrl from QuestionOption").all();
const byQ=new Map(); for (const o of opts) byQ.set(o.questionId,(byQ.get(o.questionId)||[]).concat(o));
const JUNK=[
 [/\bCOM[A-Z]{0,2}\s+BACK\s+LATER\b|\bBACK LATER\b/i,"nota 'come back later'"],
 [/(^|\s)#{2,}(\s|$)|#{2,}\s*(MATH|READING|WRITING)/,"marcador ##"],
 [/\b(MATH|READING AND WRITING|READING & WRITING)\s*$/,"sección al final"],
 [/Question ID\s*:?\s*[0-9a-f]{6,}/i,"Question ID"],
 [/\bMark for Review\b/i,"UI 'Mark for Review'"],
 [/\bModule\s+[12]\b.*\b(Directions|minutes)\b/i,"cabecera de módulo"],
 [/\bAnswer Explanations?\b|\bRationale\b/,"cabecera explicación"],
 [/�/,"carácter roto �"],
 [/\b(Page|Página)\s+\d+\s+of\s+\d+\b/i,"pie de página"],
 [/\bCorrect Answer\s*:/i,"'Correct Answer:' incrustado"],
];
function dollarsUnbalanced(s){ const n=(s.replace(/\\\$/g,"").match(/\$/g)||[]).length; return n%2===1; }
const issues=[];
const add=(q,field,kind,sample)=>{ if(!used.has(q.id)) return; issues.push({kind,field,id:q.id,where:used.get(q.id)[0],sample:(sample||"").replace(/\s+/g," ").slice(0,110)}); };
const fileExists=(u)=>{ if(!u||/^https?:/.test(u)) return true; const p=u.split("?")[0]; return [path.join(ROOT,"public",p), path.join(ROOT,p)].some(f=>fs.existsSync(f)); };
for (const q of qs) {
  const o=(byQ.get(q.id)||[]).sort((a,b)=>a.label.localeCompare(b.label));
  const fields=[["stem",q.stem],["stimulus",q.stimulus],["explanation",q.explanation],...o.map(x=>["opción "+x.label,x.text])];
  for (const [f,v] of fields) { if(!v) continue;
    for (const [re,k] of JUNK) if (re.test(v) && !(k==="cabecera explicación" && f==="explanation")) add(q,f,k,v);
    if (f!=="explanation" && dollarsUnbalanced(v)) add(q,f,"$ desbalanceado (LaTeX roto)",v);
  }
  if (q.type==="MC") {
    const labels=o.map(x=>x.label);
    if (!labels.includes(q.correctAnswer)) add(q,"clave","clave MC no está entre las opciones",`clave=${q.correctAnswer} opciones=${labels.join("")}`);
    if (o.length!==4) add(q,"opciones",`MC con ${o.length} opciones`,labels.join(","));
    for (const x of o) if(!x.text.trim() && !x.imageUrl) add(q,"opción "+x.label,"opción vacía sin imagen","");
    const texts=o.map(x=>x.text.trim()).filter(Boolean); if (new Set(texts).size!==texts.length) add(q,"opciones","opciones duplicadas",texts.join(" | "));
  } else if (q.type==="NUMERIC") {
    if (o.some(x=>x.text.trim())) add(q,"opciones","NUMERIC con opciones con texto",o.map(x=>x.label+":"+x.text).join(" | "));
    if (/^[A-D]$/.test((q.correctAnswer||"").trim())) add(q,"clave","NUMERIC con clave letra",q.correctAnswer);
  }
  if (!q.stem?.trim() && !q.imageUrl) add(q,"stem","enunciado vacío sin imagen","");
  if (!fileExists(q.imageUrl)) add(q,"imagen","imagen de la pregunta no existe en disco",q.imageUrl);
  for (const x of o) if (!fileExists(x.imageUrl)) add(q,"opción "+x.label,"imagen de opción no existe",x.imageUrl);
}
const by={}; for (const i of issues){ (by[i.kind]=by[i.kind]||[]).push(i); }
console.log("preguntas en uso:",[...used.keys()].length,"incidencias:",issues.length);
for (const [k,v] of Object.entries(by)) { console.log(`\n## ${k} (${v.length})`); for (const i of v.slice(0,12)) console.log(`  ${i.where} [${i.field}] ${i.id} :: ${i.sample}`); }
fs.writeFileSync(process.argv[2]||"/dev/null", JSON.stringify(issues,null,1));
