# Validación v2: re-OCR (Mistral) de TODAS las páginas promovidas de 1 PDF de práctica.
# Parsea el formato oficial SAT (# Question / # Answer / # Correct Answer / # Rationale)
# y reporta cuántas recuperan 4 opciones de TEXTO vs opciones-tabla vs fallo.
# Solo lectura de candidatos (persiste OcrCache). Corre en el contenedor ingest.
import sys, sqlite3, os, re, json
sys.path.insert(0, "/service")
from app.main import run_mistral_ocr, IngestConfig  # type: ignore
from pathlib import Path

SRC = os.getenv("REOCR_SRC", "src_a9757882bc5343519a247266b53acb30")
DB = os.getenv("REOCR_DB", "/app/dev.db")
LIMIT = int(os.getenv("REOCR_LIMIT", "999"))

def parse_sat_ocr(text):
    """Devuelve dict(stem, options[{label,text,isTable}], answer, explanation) o None."""
    t = text.replace("\r", "")
    # stem: entre '# Question' y '# Answer'
    mq = re.search(r"#\s*Question\b\s*(?:ID:[^\n]*)?\n(.*?)(?=#\s*Answer\b)", t, re.S | re.I)
    stem = None
    if mq:
        stem = mq.group(1)
    # bloque de opciones: entre '# Answer' y ('Correct Answer' o '# Rationale')
    ma = re.search(r"#\s*Answer\b\s*\n(.*?)(?=\n#?\s*Correct Answer|#\s*Rationale|$)", t, re.S | re.I)
    options = []
    if ma:
        blk = ma.group(1)
        # captura A. / B. / C. / D. con su texto hasta la siguiente letra
        for m in re.finditer(r"(?m)^\s*([A-D])[.)]\s*(.*?)(?=^\s*[A-D][.)]|\Z)", blk, re.S):
            label = m.group(1).upper()
            txt = m.group(2).strip()
            is_table = bool(re.search(r"\[tbl-\d+\.html\]|\[img-\d+", txt)) or txt == ""
            # limpia imágenes markdown del texto
            clean = re.sub(r"\[tbl-\d+\.html\]\([^)]*\)|\!\[[^\]]*\]\([^)]*\)", "", txt).strip()
            options.append({"label": label, "text": clean, "isTable": is_table and clean == ""})
    man = re.search(r"Correct Answer:?\s*\**([A-D])\b", t, re.I)
    answer = man.group(1).upper() if man else None
    mr = re.search(r"#\s*Rationale\b\s*\n(.*)$", t, re.S | re.I)
    expl = mr.group(1).strip() if mr else None
    if stem is not None:
        stem = re.sub(r"\[tbl-\d+\.html\]\([^)]*\)", "", stem).strip()
    return {"stem": stem, "options": options, "answer": answer, "explanation": expl}

cfg = IngestConfig.from_env()
print("mistral key:", bool(cfg.mistral_api_key))
db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
rows = db.execute(
    """SELECT c.id candId, c.questionNumber, c.officialQuestionId, p.pageNumber, f.path
       FROM IngestQuestionCandidate c JOIN IngestPageArtifact p ON p.id=c.pageArtifactId
       JOIN IngestSourceFile f ON f.id=c.sourceFileId
       WHERE c.sourceFileId=? AND c.officialQuestionId IS NOT NULL ORDER BY p.pageNumber""",
    (SRC,)).fetchall()
print(f"promoted candidates: {len(rows)}")
full_text=0; table_opts=0; fail=0; no_answer=0; samples=[]
for row in rows[:LIMIT]:
    path=row["path"]; pageno=int(row["pageNumber"])
    if not Path(path).exists(): fail+=1; continue
    ocr,_=run_mistral_ocr(Path(path), pageno)
    if not ocr: fail+=1; continue
    p=parse_sat_ocr(ocr)
    n_text=sum(1 for o in p["options"] if o["text"] and not o["isTable"])
    n_opts=len(p["options"])
    if p["answer"] is None: no_answer+=1
    if n_opts>=4 and n_text>=4 and p["answer"]: full_text+=1
    elif n_opts>=4 and p["answer"]: table_opts+=1
    else:
        fail+=1
        if len(samples)<3: samples.append({"q":row["questionNumber"],"nopts":n_opts,"ntext":n_text,"ans":p["answer"],"stem":(p["stem"] or "")[:70]})
print(f"\n4 opciones de TEXTO + answer: {full_text}")
print(f"opciones-tabla (necesitan imagen) + answer: {table_opts}")
print(f"sin answer detectada: {no_answer}")
print(f"fallo: {fail}")
print("muestras fallo:", json.dumps(samples, ensure_ascii=False))
db.close()
