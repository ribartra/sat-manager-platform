import sys, sqlite3, os, json
sys.path.insert(0, "/service")
from app.main import IngestConfig, MistralOcrClient  # type: ignore
from pathlib import Path

DB = os.getenv("REOCR_DB", "/app/dev.db")
cfg = IngestConfig.from_env()
print("mistral key present:", bool(cfg.mistral_api_key), "last4:", (cfg.mistral_api_key or "")[-4:] if cfg.mistral_api_key else None)
client = MistralOcrClient(cfg)
print("client initialized:", bool(client.client))

db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
rows = db.execute("""
  SELECT c.questionNumber qn, p.pageNumber pn, p.contentHash ch, f.path, f.relativePath rp,
    (SELECT count(*) FROM QuestionOption o WHERE o.questionId=c.officialQuestionId AND o.text<>'') nText
  FROM IngestQuestionCandidate c
  JOIN IngestPageArtifact p ON p.id=c.pageArtifactId
  JOIN IngestSourceFile f ON f.id=c.sourceFileId
  WHERE c.contentType='PRACTICE_SET' AND c.officialQuestionId IS NOT NULL
  ORDER BY f.relativePath, p.pageNumber
""").fetchall()
targets = [r for r in rows if r["nText"] < 4]
print("broken targets:", len(targets))
for r in targets[:3]:
    print("\n===", r["rp"], "page", r["pn"], "q", r["qn"], "===")
    print("file exists:", Path(r["path"]).exists())
    cached = db.execute("SELECT length(text) L FROM IngestOcrCache WHERE contentHash=? AND model=?", (r["ch"], os.getenv("OCR_MODEL","mistral-ocr-latest"))).fetchone()
    print("cached:", cached["L"] if cached else None)
    text, payload = client.process_page(Path(r["path"]), int(r["pn"]))
    print("text len:", len(text) if text else 0)
    print("payload keys:", list(payload.keys()))
    for k in ("warning","fallbackWarning","pdfOcrWarning","blankPage","error","ocrSource"):
        if k in payload: print("  ", k, "=", str(payload[k])[:200])
db.close()
