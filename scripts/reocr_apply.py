# Segunda capa de OCR (Mistral) para PRÁCTICA extraída como PDF_TEXT (opciones/mate
# perdidas como glifos vectoriales). Re-OCR de cada página con candidato promovido roto,
# parsea el formato oficial SAT, e INTEGRA en staging (UPDATE del candidate existente,
# preservando officialQuestionId — no crea candidatos) + persiste OcrCache + actualiza la
# página a MISTRAL_OCR. También parcha la Question promovida (stem/answer/explicación/
# opciones de texto) cuando la recuperación es completa.
#
# Corre en el contenedor ingest, con el dev server DETENIDO (escribe dev.db).
#   REOCR_SRC=<sourceFileId>  -> solo ese archivo (validación)
#   sin REOCR_SRC             -> TODAS las prácticas rotas PDF_TEXT
#   --apply                   -> escribe (por defecto dry-run)
import sys, sqlite3, os, re, json, uuid, datetime
sys.path.insert(0, "/service")
from app.main import run_mistral_ocr, OCR_MODEL  # type: ignore
from pathlib import Path

DB = os.getenv("REOCR_DB", "/app/dev.db")
SRC = os.getenv("REOCR_SRC")  # opcional
APPLY = "--apply" in sys.argv
now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "+00:00")

def parse_sat_ocr(text):
    t = text.replace("\r", "")
    # stem: preferir el header '# Question' que NO sea 'ID:'; si no, el primero
    mq = re.search(r"#\s*Question\b(?!\s*ID:)[^\n]*\n(.*?)(?=#\s*Answer\b)", t, re.S | re.I)
    if not mq:
        mq = re.search(r"#\s*Question\b[^\n]*\n(.*?)(?=#\s*Answer\b)", t, re.S | re.I)
    stem = mq.group(1) if mq else None
    if stem is not None:
        stem = re.sub(r"(?mi)^#\s*Question.*$", "", stem)   # headers sueltos
        stem = re.sub(r"(?mi)^\s*Question ID:.*$", "", stem)
    ma = re.search(r"#\s*Answer\b\s*\n(.*?)(?=\n#?\s*Correct Answer|#\s*Rationale|$)", t, re.S | re.I)
    options = []
    if ma:
        for m in re.finditer(r"(?m)^\s*([A-D])[.)]\s*(.*?)(?=^\s*[A-D][.)]|\Z)", ma.group(1), re.S):
            raw = m.group(2).strip()
            clean = re.sub(r"\[tbl-\d+\.html\]\([^)]*\)|\!\[[^\]]*\]\([^)]*\)", "", raw).strip()
            has_asset = bool(re.search(r"\[tbl-\d+\.html\]|\!\[img", raw))
            options.append({"label": m.group(1).upper(), "text": clean, "hasAsset": has_asset})
    man = re.search(r"Correct Answer:?\s*\**([A-D])\b", t, re.I)
    answer = man.group(1).upper() if man else None
    mr = re.search(r"#\s*Rationale\b\s*\n(.*)$", t, re.S | re.I)
    expl = mr.group(1).strip() if mr else None
    if stem is not None:
        stem = re.sub(r"\[tbl-\d+\.html\]\([^)]*\)", "", stem).strip()
    stem_has_img = bool(stem and re.search(r"\!\[img", stem))
    if stem is not None:
        stem = re.sub(r"\!\[[^\]]*\]\([^)]*\)", "", stem).strip()
    return {"stem": stem, "options": options, "answer": answer, "explanation": expl, "stemHasImg": stem_has_img}

db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
where = "c.contentType='PRACTICE_SET' AND c.officialQuestionId IS NOT NULL"
params = []
if SRC:
    where += " AND c.sourceFileId=?"; params.append(SRC)
rows = db.execute(f"""
    SELECT c.id candId, c.questionNumber, c.officialQuestionId qid, c.pageArtifactId pid,
           p.pageNumber, p.contentHash, f.path,
           (SELECT count(*) FROM QuestionOption o WHERE o.questionId=c.officialQuestionId AND o.text<>'') nText
    FROM IngestQuestionCandidate c
    JOIN IngestPageArtifact p ON p.id=c.pageArtifactId
    JOIN IngestSourceFile f ON f.id=c.sourceFileId
    WHERE {where}
    ORDER BY f.relativePath, p.pageNumber
""", params).fetchall()
# solo las rotas (Question con <4 opciones de texto)
targets = [r for r in rows if r["nText"] < 4]
print(f"objetivo: {len(targets)} preguntas de práctica (de {len(rows)} candidatos PDF_TEXT){' [APPLY]' if APPLY else ' [dry-run]'}")

stat = {"full_text": 0, "needs_figure": 0, "failed": 0}
for i, r in enumerate(targets, 1):
    path = r["path"]
    if not Path(path).exists():
        stat["failed"] += 1; continue
    # usar caché OCR si existe (evita re-cobrar en re-corridas)
    ocr = None; payload = {"cached": True}
    if r["contentHash"]:
        cached = db.execute("SELECT text FROM IngestOcrCache WHERE contentHash=? AND model=?", (r["contentHash"], OCR_MODEL)).fetchone()
        if cached and cached[0]:
            ocr = cached[0]
    if ocr is None:
        ocr, payload = run_mistral_ocr(Path(path), int(r["pageNumber"]))
    if not ocr:
        stat["failed"] += 1; continue
    p = parse_sat_ocr(ocr)
    text_opts = [o for o in p["options"] if o["text"] and not o["hasAsset"]]
    complete = len(p["options"]) >= 4 and len(text_opts) >= 4 and p["answer"] and not p["stemHasImg"]
    if complete:
        stat["full_text"] += 1
    elif p["answer"]:
        stat["needs_figure"] += 1
    else:
        stat["failed"] += 1
    if i <= 3 or i % 25 == 0:
        print(f"  [{i}/{len(targets)}] q{r['questionNumber']} opts={len(p['options'])} text={len(text_opts)} ans={p['answer']} figure={p['stemHasImg']} -> {'FULL' if complete else ('FIG' if p['answer'] else 'FAIL')}")
    if not APPLY:
        continue
    # --- persistir OCR + página ---
    db.execute("INSERT OR IGNORE INTO IngestOcrCache (id, contentHash, model, responseJson, text, updatedAt) VALUES (?,?,?,?,?,?)",
               (f"ocr_{uuid.uuid4().hex}", r["contentHash"], OCR_MODEL, json.dumps(payload)[:1_000_000], ocr, now))
    db.execute("UPDATE IngestPageArtifact SET method='MISTRAL_OCR', extractedText=?, requiresOcr=0, updatedAt=? WHERE id=?",
               (ocr, now, r["pid"]))
    # --- integrar en el candidate (sin duplicar) ---
    cand_opts = [{"label": o["label"], "text": o["text"]} for o in p["options"]]
    db.execute("UPDATE IngestQuestionCandidate SET stem=COALESCE(?,stem), optionsJson=?, correctAnswer=COALESCE(?,correctAnswer), explanation=COALESCE(?,explanation), type='MC', updatedAt=? WHERE id=?",
               (p["stem"], json.dumps(cand_opts, ensure_ascii=False), p["answer"], p["explanation"], now, r["candId"]))
    # --- parchar la Question SOLO si recuperación completa (contestable) ---
    if complete:
        qid = r["qid"]
        db.execute("DELETE FROM QuestionOption WHERE questionId=?", (qid,))
        for o in text_opts[:4]:
            db.execute("INSERT INTO QuestionOption (id, questionId, label, text, imageUrl) VALUES (?,?,?,?,NULL)",
                       (f"opt_{uuid.uuid4().hex}", qid, o["label"], o["text"]))
        db.execute("UPDATE Question SET type='MC', stem=COALESCE(?,stem), correctAnswer=?, explanation=COALESCE(?,explanation), updatedAt=? WHERE id=?",
                   (p["stem"], p["answer"], p["explanation"], now, qid))
    db.commit()

print("\nResumen:")
print(f"  recuperación COMPLETA (texto, contestable): {stat['full_text']}")
print(f"  parcial (answer+stem, necesita figura/tabla): {stat['needs_figure']}")
print(f"  fallo: {stat['failed']}")

# --- limpieza global de stems: quitar headers markdown '# Question' / 'Question ID:' ---
def clean_stem(s):
    if not s: return s
    s = re.sub(r"(?mi)^#\s*Question.*$", "", s)
    s = re.sub(r"(?mi)^\s*Question ID:.*$", "", s)
    return s.strip()
if APPLY:
    cleaned = 0
    for tbl, col in (("Question", "stem"), ("IngestQuestionCandidate", "stem")):
        rowsc = db.execute(f"SELECT id, {col} v FROM {tbl} WHERE {col} LIKE '# Question%' OR {col} LIKE '%Question ID:%'").fetchall()
        for rc in rowsc:
            nv = clean_stem(rc["v"])
            if nv != rc["v"]:
                db.execute(f"UPDATE {tbl} SET {col}=? WHERE id=?", (nv, rc["id"])); cleaned += 1
    db.commit()
    print(f"  stems limpiados (headers markdown): {cleaned}")
db.close()
