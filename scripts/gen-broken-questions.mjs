// Genera docs/broken-questions.md: por cada conjunto (PracticeSet y FullPracticeTest)
// lista las preguntas con problemas y qué les falta para ser contestables/publicables.
// Solo lectura de dev.db.
import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('./dev.db', { readonly: true });
const AD = new Set(['A', 'B', 'C', 'D']);
const preview = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 80);

// Analiza una pregunta -> { ok, answerable, issues[] }
const qStmt = db.prepare(`
  SELECT q.id, q.type, q.difficulty, q.correctAnswer, q.stem, q.explanation, q.imageUrl, q.topicId,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id) nOpts,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text IS NOT NULL AND o.text<>'') nText,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.imageUrl IS NOT NULL) nImg
  FROM Question q WHERE q.id=?
`);
function analyze(id) {
  const q = qStmt.get(id);
  const issues = [];
  let blocking = false;
  if (!(q.stem || '').trim()) { issues.push('sin enunciado'); blocking = true; }
  if (!(q.correctAnswer || '').trim()) { issues.push('sin respuesta'); blocking = true; }
  if (!q.topicId) { issues.push('sin topic'); blocking = true; }
  if (!q.difficulty) { issues.push('sin dificultad'); blocking = true; }
  if (q.type === 'MC') {
    const hasImg = !!q.imageUrl || q.nImg > 0;
    const hasButtons = q.nOpts >= 4; // 4 botones A–D clickeables presentes
    if (q.nOpts === 0 && !hasImg) { issues.push('MC sin opciones ni imagen (opciones no recuperadas del OCR)'); blocking = true; }
    // image-backed contestable: la imagen del stem muestra las opciones y hay 4 botones A–D
    else if (hasImg && hasButtons) { if (q.nText < 4) issues.push(`_opciones en imagen (${q.nText}/4 con texto); contestable vía imagen + botones A–D_`); }
    else if (hasImg && !hasButtons) { issues.push(`opciones en imagen pero faltan botones A–D (${q.nOpts} de 4)`); blocking = true; }
    else if (q.nText < 4) { issues.push(`opciones de texto incompletas (${q.nText}/4)`); blocking = true; }
    if ((q.correctAnswer || '').trim() && !AD.has((q.correctAnswer || '').trim())) { issues.push(`respuesta MC no es A–D ("${q.correctAnswer}")`); blocking = true; }
  }
  if (q.type === 'NUMERIC' && AD.has((q.correctAnswer || '').trim())) { issues.push(`tipo mal detectado: es MC (respuesta ${q.correctAnswer}) marcada como NUMERIC — faltan opciones A–D`); blocking = true; }
  else if (q.type === 'NUMERIC' && (q.correctAnswer || '').trim() && !/[0-9]/.test(q.correctAnswer)) { issues.push(`respuesta numérica inválida ("${preview(q.correctAnswer)}")`); blocking = true; }
  if (!(q.explanation || '').trim()) issues.push('_sin explicación (no bloquea contestar, sí publicar estricto)_');
  const answerable = !blocking;
  const ok = answerable && (q.explanation || '').trim();
  return { q, issues, blocking, answerable, ok };
}

const out = [];
out.push('# Preguntas con problemas por conjunto');
out.push('');
out.push(`> Generado ${new Date().toISOString().slice(0, 10)} desde \`dev.db\`. "Problema" = la pregunta no es contestable por un alumno o no cumple la validación de publicación. **Solo se listan pendientes**: módulos, tests y practice sets sin problemas se omiten. La leyenda de faltantes está al pie.`);
out.push('');

// ---------- PRACTICE SETS ----------
const sets = db.prepare("SELECT id, name, difficulty, status FROM PracticeSet ORDER BY name").all();
let psClean = 0, psProblem = 0, psBrokenQ = 0;
const psSections = [];
for (const s of sets) {
  const members = db.prepare('SELECT questionId, "order" FROM PracticeSetQuestion WHERE practiceSetId=? ORDER BY "order"').all(s.id);
  const problems = [];
  for (const m of members) {
    const a = analyze(m.questionId);
    if (a.blocking) problems.push({ n: m.order + 1, a });
  }
  if (problems.length === 0) { psClean++; continue; }
  psProblem++; psBrokenQ += problems.length;
  const lines = [];
  lines.push(`### ${s.name}`);
  lines.push(`*${s.status}* · ${members.length} preguntas · **${problems.length} con problemas**`);
  lines.push('');
  lines.push('| # | Tipo | Falta | Enunciado |');
  lines.push('|---|---|---|---|');
  for (const p of problems) {
    const blockingIssues = p.a.issues.filter((i) => !i.startsWith('_'));
    lines.push(`| ${p.n} | ${p.a.q.type} | ${blockingIssues.join('; ')} | ${preview(p.a.q.stem) || '_(vacío)_'} |`);
  }
  lines.push('');
  psSections.push(lines.join('\n'));
}

// ---------- FULL PRACTICE TESTS ----------
const fts = db.prepare('SELECT id, name, status FROM FullPracticeTest ORDER BY name').all();
let ftBrokenQ = 0;
const ftSections = [];
for (const ft of fts) {
  const mods = db.prepare('SELECT id, name, "order" FROM FullPracticeTestModule WHERE testId=? ORDER BY "order"').all(ft.id);
  const modReport = [];
  let testProblems = 0, testTotal = 0;
  for (const mod of mods) {
    const mq = db.prepare('SELECT questionId, "order" FROM FullPracticeTestQuestion WHERE moduleId=? ORDER BY "order"').all(mod.id);
    testTotal += mq.length;
    const probs = [];
    for (const m of mq) { const a = analyze(m.questionId); if (a.blocking) probs.push({ n: m.order + 1, a }); }
    testProblems += probs.length; ftBrokenQ += probs.length;
    // Solo pendientes: los módulos sin problemas se omiten por completo.
    if (probs.length) {
      modReport.push(`**${mod.name}** — ${mq.length} preguntas, ${probs.length} con problemas:`);
      modReport.push('');
      modReport.push('| # | Tipo | Falta | Enunciado |');
      modReport.push('|---|---|---|---|');
      for (const p of probs) {
        const bi = p.a.issues.filter((i) => !i.startsWith('_'));
        modReport.push(`| ${p.n} | ${p.a.q.type} | ${bi.join('; ')} | ${preview(p.a.q.stem) || '_(vacío)_'} |`);
      }
      modReport.push('');
    }
  }
  // Solo pendientes: los tests completamente limpios no aparecen.
  if (testProblems === 0) continue;
  ftSections.push(`### ${ft.name}\n*${ft.status}* · ${testTotal} preguntas · **${testProblems} con problemas**\n\n${modReport.join('\n')}`);
}

// ---------- RESUMEN ----------
out.push('## Resumen');
out.push('');
out.push(`- **Practice Sets:** ${sets.length} total · ${psClean} sin problemas (PUBLISHED) · ${psProblem} con problemas · **${psBrokenQ}** preguntas con problemas.`);
out.push(`- **Full Practice Tests:** ${fts.length} total (todos DRAFT) · **${ftBrokenQ}** preguntas con problemas.`);
out.push(`- **Total preguntas con problemas: ${psBrokenQ + ftBrokenQ}**.`);
out.push('');
out.push('## Qué significa cada "falta"');
out.push('');
out.push('- **MC sin opciones ni imagen (opciones no recuperadas del OCR):** el OCR no extrajo las alternativas y no hay imagen que las muestre → el alumno no tiene qué elegir. Requiere transcribir/vincular las opciones desde el material de origen.');
out.push('- **opciones dentro de la imagen — faltan botones A–D:** las alternativas están en la imagen de la pregunta, pero no hay filas de opción (botones) para responder. Requiere andamiar 4 botones A–D (y opcionalmente transcribir el texto).');
out.push('- **opciones de texto incompletas (N/4):** el OCR capturó solo N de las 4 alternativas.');
out.push('- **respuesta MC no es A–D:** la respuesta correcta quedó como valor no-letra (p. ej. numérico) en una MC → revisar tipo o respuesta.');
out.push('- **tipo mal detectado (MC marcada como NUMERIC):** la respuesta es una letra A–D pero la pregunta quedó como NUMERIC porque sus opciones eran imágenes/estaban vacías → el parser no la reconoció como MC. Requiere re-tipar a MC y recuperar las 4 opciones.');
out.push('- **sin explicación:** no impide contestar, pero la publicación estricta la exige (marcada en cursiva, no cuenta como bloqueante aquí).');
out.push('');
out.push('---');
out.push('');
out.push('## Full Practice Tests');
out.push('');
out.push(...ftSections);
out.push('---');
out.push('');
out.push(`## Practice Sets con problemas (${psProblem})`);
out.push('');
out.push(...psSections);

fs.writeFileSync('docs/broken-questions.md', out.join('\n'));
console.log('docs/broken-questions.md generado.');
console.log(`Practice sets con problemas: ${psProblem} (${psBrokenQ} preguntas) | Full tests: ${ftBrokenQ} preguntas`);
db.close();
