// Deterministic artifact scan for a Full Practice Test's published questions (read-only).
// Encodes the defect-class heuristics found in TEST 1 and TEST 2 QA.
// Usage: node scripts/qa/scan-artifacts.mjs "TEST 3"
import { openDb, resolveTestQuestions } from "./qa-common.mjs";

const testName = process.argv[2] || "TEST 3";
const db = openDb();
const qs = resolveTestQuestions(db, testName);

const RE = {
  bracket: /\[[^\]]*\/[^\]]*\]/,                         // [topic / answer]
  ui: /COM[BE]\.?\s*BACK\s*LATER|CUME\s*BACK\s*LATER|NEXT\s*QUESTION|PREV\.?\s*QUESTION|##\s*(MATH|READING|WRITING)|\bMODULE\s*[12]\b/i,
  tbl: /\[tbl[-_][^\]]*\]|\(tbl[-_][^)]*\)|\.html\)/i,   // markdown table/asset placeholder
  esc: /\\_/,                                            // escaped underscore blank
  stemNum: /^\s*\d{1,2}\.\s/,                            // leading question number "4. "
};
function tag(q){ return `${q.section} ${q.moduleName.includes("Module 2")?"M2":"M1"}#${q.moduleSeq}`; }

const flags = { bracket:[], ui:[], tbl:[], esc:[], stemNum:[], optLabelLeak:[], mcFewOpts:[], emptyStem:[], numAlpha:[], optDupStim:[] };

// build option-set signature per question for duplicate-options detection
const sig = new Map();
for (const q of qs) sig.set(q.qid, q.options.map(o=>(o.text||"").trim()).join("||"));
const sigCount = {};
for (const q of qs) { const s=sig.get(q.qid); if(s && s.replace(/\|/g,"").length>0){ sigCount[s]=(sigCount[s]||0)+1; } }

for (const q of qs) {
  const stem=(q.stem||""), stim=(q.stimulus||"");
  if (RE.bracket.test(stem)) flags.bracket.push(tag(q)+" "+q.qid);
  if (RE.ui.test(stem)||RE.ui.test(stim)) flags.ui.push(tag(q)+" "+q.qid+(RE.ui.test(stem)?"[stem]":"")+(RE.ui.test(stim)?"[stim]":""));
  if (RE.esc.test(stem)||RE.esc.test(stim)) flags.esc.push(tag(q)+" "+q.qid);
  if (RE.stemNum.test(stem)) flags.stemNum.push(tag(q)+" "+q.qid);
  if (!stem.trim()) flags.emptyStem.push(tag(q)+" "+q.qid);
  if (q.type==="NUMERIC" && /[a-zA-Z]/.test(q.correctAnswer||"")) flags.numAlpha.push(tag(q)+" "+q.qid+" ans="+JSON.stringify(q.correctAnswer));
  const opts=q.options;
  if (q.type==="MC"){ const usable=opts.filter(o=>(o.text||"").trim()||o.imageUrl).length; if(usable>0&&usable<4) flags.mcFewOpts.push(tag(q)+" "+q.qid+" usable="+usable); }
  for (const o of opts){
    const t=(o.text||"").trim();
    if (new RegExp("^"+o.label+"\\s+\\S").test(t)) flags.optLabelLeak.push(tag(q)+" "+q.qid+" opt"+o.label);
    if (RE.tbl.test(t)) flags.tbl.push(tag(q)+" "+q.qid+" opt"+o.label);
    if (RE.ui.test(t)) flags.ui.push(tag(q)+" "+q.qid+" opt"+o.label);
    // option A that duplicates a big chunk of the stimulus (broken_question signal)
    if (o.label==="A" && stim.length>60 && t.length>40){
      const a=t.slice(0,40).toLowerCase(), s=stim.toLowerCase();
      if (s.includes(a)) flags.optDupStim.push(tag(q)+" "+q.qid+" (optA⊂stimulus)");
    }
  }
  // duplicated whole option-set across questions (like TEST1 Math M2#8)
  const s=sig.get(q.qid);
  if (s && s.replace(/\|/g,"").length>0 && sigCount[s]>1) flags.optDupStim.push(tag(q)+" "+q.qid+" (optset shared x"+sigCount[s]+")");
}

console.log("=== "+testName+" artifact scan ("+qs.length+" Q) ===");
for (const [k,v] of Object.entries(flags)){
  console.log(`\n[${k}] ${v.length}`);
  for (const x of v) console.log("   "+x);
}
