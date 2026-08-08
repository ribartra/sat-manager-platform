# Capa 2 de OCR — SOLO FETCH. Llama a Mistral para las páginas de práctica rotas
# (MC promovida con <4 opciones de texto) que NO tienen OCR cacheado, y guarda el
# resultado en IngestOcrCache + marca la página como MISTRAL_OCR. NO parsea ni toca
# Question/Candidate (eso lo hace scripts/reocr_reparse_cached.mjs en el host, con el
# parser ya probado). Corre en el contenedor ingest, con el dev server DETENIDO.
import sys, sqlite3, os, json, uuid, datetime
sys.path.insert(0, "/service")
from app.main import run_mistral_ocr, OCR_MODEL  # type: ignore
from pathlib import Path

DB = os.getenv("REOCR_DB", "/app/dev.db")
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
rows = db.execute("""
    SELECT c.questionNumber qn, p.id pid, p.pageNumber pn, p.contentHash ch, f.path, f.relativePath rp
    FROM IngestQuestionCandidate c
    JOIN Question q ON q.id = c.officialQuestionId
    JOIN IngestPageArtifact p ON p.id = c.pageArtifactId
    JOIN IngestSourceFile f ON f.id = c.sourceFileId
    WHERE c.contentType='PRACTICE_SET' AND c.officialQuestionId IS NOT NULL
      AND q.type='MC'
      AND (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text<>'') < 4
      AND NOT EXISTS (SELECT 1 FROM IngestOcrCache oc WHERE oc.contentHash=p.contentHash AND oc.model=?)
    ORDER BY f.relativePath, p.pageNumber
""", (OCR_MODEL,)).fetchall()

print(f"páginas a OCR-ear (rotas, sin caché): {len(rows)}", flush=True)
ok = 0; empty = 0; missing = 0
for i, r in enumerate(rows, 1):
    path = r["path"]
    if not Path(path).exists():
        missing += 1; continue
    if not r["ch"]:
        missing += 1; continue
    text, payload = run_mistral_ocr(Path(path), int(r["pn"]))
    if not text:
        empty += 1
    else:
        ok += 1
        db.execute("INSERT OR IGNORE INTO IngestOcrCache (id, contentHash, model, responseJson, text, updatedAt) VALUES (?,?,?,?,?,?)",
                   (f"ocr_{uuid.uuid4().hex}", r["ch"], OCR_MODEL, json.dumps(payload)[:1_000_000], text, now))
        db.execute("UPDATE IngestPageArtifact SET method='MISTRAL_OCR', extractedText=?, requiresOcr=0, updatedAt=? WHERE id=?",
                   (text, now, r["pid"]))
        db.commit()
    if i <= 3 or i % 25 == 0 or i == len(rows):
        print(f"  [{i}/{len(rows)}] q{r['qn']} textlen={len(text) if text else 0} ok={ok} empty={empty}", flush=True)

print(f"\nResumen fetch: OCR con texto={ok}, vacío={empty}, archivo faltante={missing}", flush=True)
db.close()
