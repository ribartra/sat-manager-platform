#!/usr/bin/env python3
"""Robustece las respuestas del ans_metadata.json reutilizando la lógica de
extracción del ingest_service (extract_correct_answer / clean_answer_value), en
vez de regex frágiles. Recorre los PDFs ANS por bloque de Question ID y aplica la
misma función que usa el pipeline oficial. Solo actualiza el campo correctAnswer.
"""
import os, re, json, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF_BASE = os.path.join(ROOT, "files_to_load", "PRACTICE EXERCISES")
OUT = os.environ.get("OUT_DIR", "/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/2e6ab720-85cc-4491-b237-6d268296bdbf/scratchpad")
import pdfplumber

# ---- funciones copiadas verbatim de ingest_service/app/main.py (lógica oficial) ----
ANSWER_RE = re.compile(r"Correct Answer\s*[:：]\s*([A-D]|[-+]?\d+(?:/\d+)?(?:\.\d+)?)", re.IGNORECASE)

def clean_answer_value(value: str):
    if re.search(r"\bextra\b", value, re.IGNORECASE):
        return None
    value = re.sub(r"\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}", r"\1/\2", value)
    cleaned = re.sub(r"[*_`$]", "", value)
    cleaned = re.sub(r"^\s*(?:✓|✔|✗|✘|×|x)\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\(?:frac|sqrt)\s*", "", cleaned)
    cleaned = cleaned.replace("{", "").replace("}", "")
    cleaned = re.sub(r"\s+", " ", cleaned.replace("|", " ")).strip(" .;:#")
    letter = re.match(r"^([A-Da-d])(?:\b|[^A-Za-z0-9])", cleaned)
    if letter:
        return letter.group(1).upper()
    numeric_list = re.match(
        r"^([-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?)(?:\s*,\s*[-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?))+)(?:\b|[^A-Za-z0-9/])",
        cleaned,
    )
    if numeric_list:
        return numeric_list.group(1).replace("−", "-")
    numeric = re.match(r"^([-+]?(?:\d+(?:/\d+)?|\d*\.\d+|[−-]\d+(?:/\d+)?))(?:\b|[^A-Za-z0-9/])", cleaned)
    if numeric:
        return numeric.group(1).replace("−", "-")
    if len(cleaned) <= 40 and not re.search(r"[.!?;]", cleaned) and len(cleaned.split()) <= 4:
        return cleaned or None
    return None

def extract_correct_answer(text: str):
    checked = re.search(r"(?:^|[\n|])\s*(?:✓|✔)\s*([A-D])\b", text, re.IGNORECASE)
    if checked:
        return checked.group(1).upper()
    table_solution = re.search(r"(?im)^\s*Answer\s*\|\s*(?:Solution|Choice|Why Correct).*?\n\s*([^|\n]+)", text, re.DOTALL)
    if table_solution:
        value = clean_answer_value(table_solution.group(1))
        if value:
            return value.upper() if re.fullmatch(r"[A-Da-d]", value) else value
    direct = re.search(
        r"Correct Answer\s*[:：]\s*(?:\n|\s|\|)*(.*?)(?=(?:\n|\s|\|)+(?:#*\s*Rationale|Question Difficulty|Choice [A-D]\b)|$)",
        text, re.IGNORECASE | re.DOTALL,
    )
    if direct:
        value = clean_answer_value(direct.group(1))
        if value:
            return value.upper() if re.fullmatch(r"[A-Da-d]", value) else value
    sentence = re.search(r"The correct answer is\s+(.+?)(?:\.|\n)", text, re.IGNORECASE | re.DOTALL)
    if sentence:
        return clean_answer_value(sentence.group(1))
    choice_sentence = re.search(r"\bChoice\s+([A-D])\s+is\s+(?:the\s+)?(?:best\s+answer|correct)\b", text, re.IGNORECASE)
    if choice_sentence:
        return choice_sentence.group(1).upper()
    legacy = ANSWER_RE.search(text)
    if legacy:
        value = clean_answer_value(legacy.group(1))
        return value.upper() if value and re.fullmatch(r"[A-Da-d]", value) else value
    return None
OPTION_MARKER = r"(?:[×✕✖※*•-]\s*)?"
OPTION_RE = re.compile(
    rf"(?:^|\n)\s*{OPTION_MARKER}([A-D])(?:[\).])?\s+(.+?)(?=(?:\n\s*{OPTION_MARKER}[A-D](?:[\).])?\s+)|(?:\n\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER|$))|$)",
    re.IGNORECASE | re.DOTALL,
)
def clean_ingested_question_text(value: str) -> str:
    value = re.sub(r"(?im)^\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER)\s*$", "", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()

def extract_options_and_stem(text: str):
    matches = list(OPTION_RE.finditer(text))
    if not matches:
        return [], clean_ingested_question_text(text)
    options, seen = [], set()
    for match in matches:
        label = match.group(1).upper()
        option_text = clean_ingested_question_text(" ".join(match.group(2).split()))
        if label in seen or not option_text:
            continue
        options.append({"label": label, "text": option_text[:2000]})
        seen.add(label)
    if len(options) < 2:
        return [], clean_ingested_question_text(text)
    stem = clean_ingested_question_text(text[: matches[0].start()] + text[matches[-1].end():])
    return options, stem
# ---- fin copia ----

QID_RE = re.compile(r"(?:Question\s+ID|ID)\s*:?\s*([0-9a-fA-F]{6,})")

def parse_pdf(path):
    with pdfplumber.open(path) as pdf:
        full = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    ids = list(QID_RE.finditer(full))
    out = {}
    for i, m in enumerate(ids):
        qid = m.group(1).lower()
        block = full[m.start(): ids[i+1].start() if i+1 < len(ids) else len(full)]
        ans = extract_correct_answer(block)
        # opciones: solo la región previa a "Correct Answer"/"Rationale" (evita letras del rationale)
        cut = re.search(r"Correct Answer|Rationale", block, re.IGNORECASE)
        opt_region = block[: cut.start()] if cut else block
        opts, _stem = extract_options_and_stem(opt_region)
        rec = out.get(qid, {})
        if ans and len(str(ans)) > len(str(rec.get("answer") or "")):
            rec["answer"] = ans
        if len(opts) == 4 and len(rec.get("options", [])) != 4:
            rec["options"] = opts
        out[qid] = rec
    return out

ans_pdfs = sorted(p for p in glob.glob(os.path.join(PDF_BASE, "**", "*.pdf"), recursive=True)
                  if os.path.basename(p).upper().startswith("ANS"))
print(f"PDFs ANS: {len(ans_pdfs)}", file=sys.stderr)
robust = {}
for j, p in enumerate(ans_pdfs):
    try:
        for qid, rec in parse_pdf(p).items():
            cur = robust.setdefault(qid, {})
            if rec.get("answer") and len(str(rec["answer"])) > len(str(cur.get("answer") or "")):
                cur["answer"] = rec["answer"]
            if rec.get("options") and len(cur.get("options", [])) != 4:
                cur["options"] = rec["options"]
    except Exception as e:
        print(f"  ERR {os.path.basename(p)}: {e}", file=sys.stderr)
    if (j+1) % 20 == 0:
        print(f"  ...{j+1}/{len(ans_pdfs)}", file=sys.stderr)

# fusionar en ans_metadata.json
meta_path = os.path.join(OUT, "ans_metadata.json")
meta = json.load(open(meta_path))
ans_n = opt_n = 0
for qid, rec in meta.items():
    r = robust.get(qid)
    if not r:
        continue
    if r.get("answer"):
        rec["correctAnswer"] = r["answer"]; ans_n += 1
    if r.get("options"):
        rec["ansOptions"] = r["options"]; opt_n += 1
json.dump(meta, open(meta_path, "w"), indent=1)
print(f"\nrespuestas robustas: {ans_n}  |  opciones limpias (4) desde ANS: {opt_n}")
