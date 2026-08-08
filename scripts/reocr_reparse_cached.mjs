// Re-parsea el OCR YA CACHEADO (IngestOcrCache) de preguntas de práctica rotas
// (MC promovida con <4 opciones de texto) usando un parser que entiende el formato
// SIN encabezados de estos PDFs de práctica:  `ID: xxxx` / enunciado / `A. B. C. D.`
// (también tolera el formato rico `# Answer` / `# Correct Answer` / `# Rationale`).
//
// NO llama a Mistral: solo lee IngestOcrCache -> costo CERO.
// - Preserva la respuesta ya existente en la BD (estos PDFs no traen el answer key).
// - Detecta NUMERIC (sin opciones) vs MC (A-D).
// - Repuebla staging (IngestQuestionCandidate.optionsJson/stem) y, si la recuperación
//   es completa y contestable, parcha la Question promovida + QuestionOption.
//
// Correr con el dev server DETENIDO.  Dry-run por defecto; `--apply` escribe.
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const DB = process.env.REOCR_DB || "dev.db";
const APPLY = process.argv.includes("--apply");
const MODEL = process.env.OCR_MODEL || "mistral-ocr-latest";
const now = new Date().toISOString();

// ---------- parser ----------
function cleanText(s) {
  if (!s) return s;
  // quita refs de imagen/tabla markdown
  s = s.replace(/\[tbl-\d+\.html\]\([^)]*\)/gi, "");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  return s.trim();
}
function hasAsset(s) {
  return /\[tbl-\d+\.html\]|!\[img|!\[[^\]]*\]\(/i.test(s || "");
}

function parseHeaderless(raw) {
  let t = (raw || "").replace(/\r/g, "").trim();
  // respuesta y racional del formato rico, si están (normalmente NO en práctica)
  const ansM = t.match(/Correct Answer\s*[:：]\s*\**([A-D])\b/i);
  const ocrAnswer = ansM ? ansM[1].toUpperCase() : null;
  const ratM = t.match(/#+\s*Rationale\b\s*\n?([\s\S]*)$/i);
  const explanation = ratM ? ratM[1].trim() : null;

  // quita encabezados sueltos:  ID:/Question ID:/# Question/# Answer
  t = t.replace(/^\s*#{0,6}\s*(?:Question\s+)?ID:.*$/gim, "");
  t = t.replace(/^\s*#{0,6}\s*Question\b.*$/gim, "");
  t = t.replace(/^\s*#{0,6}\s*Answer\b.*$/gim, "");

  // corta todo desde Rationale / Correct Answer para aislar enunciado+opciones
  let body = t.split(/#+\s*Rationale\b/i)[0];
  body = body.split(/Correct Answer\s*[:：]/i)[0];

  // marcadores de opción al inicio de línea: A. / A)  (tolera ## y * previos)
  const markerRe = /(?:^|\n)[ \t]*#{0,6}\s*(?:\*\s*)?([A-D])[.)]\s+/g;
  const markers = [];
  let m;
  while ((m = markerRe.exec(body))) {
    markers.push({ label: m[1].toUpperCase(), start: m.index, textStart: markerRe.lastIndex });
  }
  // acepta MC solo si hay un bloque contiguo A,B,C,D en orden
  let mcMarkers = null;
  for (let i = 0; i + 3 < markers.length + 0 || i < markers.length; i++) {
    if (markers[i] && markers[i].label === "A") {
      const seq = [markers[i]];
      let want = 1; // B
      for (let j = i + 1; j < markers.length && seq.length < 4; j++) {
        const expected = "ABCD"[want];
        if (markers[j].label === expected) { seq.push(markers[j]); want++; }
      }
      if (seq.length === 4) { mcMarkers = seq; break; }
    }
  }

  let stem, options = [];
  if (mcMarkers) {
    stem = cleanText(body.slice(0, mcMarkers[0].start));
    for (let k = 0; k < 4; k++) {
      const from = mcMarkers[k].textStart;
      const to = k + 1 < 4 ? mcMarkers[k + 1].start : body.length;
      const rawOpt = body.slice(from, to).trim();
      options.push({ label: mcMarkers[k].label, text: cleanText(rawOpt), asset: hasAsset(rawOpt) });
    }
  } else {
    stem = cleanText(body);
  }

  const stemHasImg = /!\[img|!\[[^\]]*\]\(/i.test(stem || "");
  stem = cleanText(stem);
  const type = mcMarkers ? "MC" : "NUMERIC";
  return { type, stem, options, ocrAnswer, explanation, stemHasImg };
}

// ---------- selección de objetivos ----------
const db = new Database(DB);
db.pragma("journal_mode = WAL");
const targets = db.prepare(`
  SELECT c.id candId, c.questionNumber qn, q.id qid, q.correctAnswer ans, q.type qtype,
         oc.text ocr,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text<>'') nText,
         f.relativePath rp
  FROM IngestQuestionCandidate c
  JOIN Question q ON q.id = c.officialQuestionId
  JOIN IngestPageArtifact p ON p.id = c.pageArtifactId
  JOIN IngestSourceFile f ON f.id = c.sourceFileId
  JOIN IngestOcrCache oc ON oc.contentHash = p.contentHash AND oc.model = ?
  WHERE c.contentType='PRACTICE_SET' AND c.officialQuestionId IS NOT NULL
    AND q.type='MC'
    AND (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text<>'') < 4
    AND length(oc.text) > 60
  ORDER BY f.relativePath, p.pageNumber
`).all(MODEL);

console.log(`objetivo: ${targets.length} preguntas de práctica rotas CON OCR cacheado${APPLY ? " [APPLY]" : " [dry-run]"}\n`);

const stat = { full_mc: 0, numeric_mismatch: 0, needs_figure: 0, no_options: 0, failed: 0 };
const samples = [];

const upCand = db.prepare(`UPDATE IngestQuestionCandidate SET stem=COALESCE(?,stem), optionsJson=?, explanation=COALESCE(?,explanation), type=?, updatedAt=? WHERE id=?`);
const delOpts = db.prepare(`DELETE FROM QuestionOption WHERE questionId=?`);
const insOpt = db.prepare(`INSERT INTO QuestionOption (id, questionId, label, text, imageUrl) VALUES (?,?,?,?,NULL)`);
const upQ = db.prepare(`UPDATE Question SET stem=COALESCE(?,stem), explanation=COALESCE(?,explanation), updatedAt=? WHERE id=?`);

const tx = db.transaction(() => {
  for (const r of targets) {
    const p = parseHeaderless(r.ocr);
    const letterAns = /^[A-D]$/.test((r.ans || "").trim()) ? r.ans.trim().toUpperCase() : null;
    const textOpts = p.options.filter(o => o.text && !o.asset);

    let outcome;
    if (p.type === "MC" && p.options.length === 4 && textOpts.length === 4 && !p.stemHasImg && letterAns) {
      outcome = "FULL_MC";
      stat.full_mc++;
    } else if (p.type === "MC" && p.options.length === 4 && !p.stemHasImg) {
      // 4 opciones pero alguna es figura/tabla (no contestable solo en texto)
      outcome = "NEEDS_FIGURE";
      stat.needs_figure++;
    } else {
      // el OCR no capturó 4 opciones; como la respuesta es letra (A-D), las opciones
      // están en la página pero el OCR no las tomó -> sigue rota (no corromper staging).
      outcome = "OPTS_NOT_CAPTURED";
      stat.no_options++;
    }

    if (samples.length < 8) samples.push(`  q${r.qn} ${outcome} type=${p.type} opts=${p.options.length} text=${textOpts.length} ans=${letterAns} :: ${(p.stem || "").slice(0, 60)}`);

    if (!APPLY) continue;

    if (outcome === "FULL_MC") {
      // repuebla staging (4 opciones) + parcha Question + QuestionOption (contestable)
      const candOpts = p.options.map(o => ({ label: o.label, text: o.text }));
      upCand.run(p.stem || null, JSON.stringify(candOpts), p.explanation, "MC", now, r.candId);
      delOpts.run(r.qid);
      for (const o of textOpts.slice(0, 4)) insOpt.run(`opt_${randomUUID().replace(/-/g, "")}`, r.qid, o.label, o.text);
      upQ.run(p.stem || null, p.explanation, now, r.qid);
    } else if (outcome === "NEEDS_FIGURE") {
      // guarda las opciones parseadas en staging (traza) pero NO parcha la Question
      const candOpts = p.options.map(o => ({ label: o.label, text: o.text }));
      upCand.run(p.stem || null, JSON.stringify(candOpts), p.explanation, "MC", now, r.candId);
    }
    // OPTS_NOT_CAPTURED / cualquier otro: no tocar (evita clobber de optionsJson)
  }
});
tx();
// en dry-run los UPDATE no se ejecutan (guardas `if(!APPLY) continue`)

console.log("Resumen:");
console.log(`  FULL_MC (4 opciones de texto, contestable, parchada): ${stat.full_mc}`);
console.log(`  NEEDS_FIGURE (opción es tabla/figura, staging actualizado): ${stat.needs_figure}`);
console.log(`  OPTS_NOT_CAPTURED (respuesta=letra pero OCR no tomó opciones; sigue rota, sin tocar): ${stat.no_options}`);
console.log(`  FAIL: ${stat.failed}`);
console.log("\nmuestras:");
console.log(samples.join("\n"));

db.close();
