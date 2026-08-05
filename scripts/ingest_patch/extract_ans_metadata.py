#!/usr/bin/env python3
"""Fase 1 (read-only): recorre los PDFs ANS* de PRACTICE EXERCISES y extrae, por
Question ID, la metadata autoritativa (section/domain/skill/difficulty +
correctAnswer + rationale). Cruza contra la taxonomía oficial (dev.db) y contra
los candidatos de staging, y reporta cobertura + mismatches. NO modifica nada.
"""
import os, re, json, sqlite3, glob, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF_BASE = os.path.join(ROOT, "files_to_load", "PRACTICE EXERCISES")
DB = os.path.join(ROOT, "dev.db")
OUT = os.environ.get("OUT_DIR", "/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/2e6ab720-85cc-4491-b237-6d268296bdbf/scratchpad")

import pdfplumber

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

# --- vocab oficial desde la BD ---
con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
skills = con.execute('SELECT t.name, d.name, s.name FROM "Topic" t '
                     'JOIN "Domain" d ON d.id=t.domainId '
                     'JOIN "Section" s ON s.id=d.sectionId').fetchall()
skill_to_domain = {norm(sk): (sk, dm) for sk, dm, se in skills}
skill_norms = sorted(skill_to_domain.keys(), key=len, reverse=True)  # más largo primero
domains = [r[0] for r in con.execute('SELECT name FROM "Domain"').fetchall()]
# candidatos PS: qid -> (candId, folderDomain, folderSkill, section, diff)
cands = con.execute('SELECT questionExternalId, id, domainName, topicName, section, difficulty '
                    'FROM "IngestQuestionCandidate" '
                    "WHERE contentType='PRACTICE_SET' AND questionExternalId IS NOT NULL").fetchall()
con.close()
cand_by_qid = {r[0]: r for r in cands}

QID_RE = re.compile(r"(?:Question\s+ID|ID)\s*:?\s*([0-9a-fA-F]{6,})")
DIFF_RE = re.compile(r"\b(Easy|Medium|Hard)\b", re.I)
ANS_RE = re.compile(r"Correct\s+Answer\s*:?\s*([^\n]{0,40})", re.I)

def match_skill(header_region):
    h = norm(header_region)
    for sk in skill_norms:
        if sk and sk in h:
            return skill_to_domain[sk]  # (skillName, domainName)
    return None

def parse_pdf(path):
    out = {}
    with pdfplumber.open(path) as pdf:
        full = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    ids = list(QID_RE.finditer(full))
    for i, m in enumerate(ids):
        qid = m.group(1).lower()
        block = full[m.start(): ids[i+1].start() if i+1 < len(ids) else len(full)]
        header = block[:280]
        section = "MATH" if re.search(r"SAT\s+Math", header, re.I) else (
                  "READING_WRITING" if re.search(r"SAT\s+Reading", header, re.I) else None)
        sk = match_skill(header)
        diff_m = DIFF_RE.search(header)
        ans_m = ANS_RE.search(block)
        rat = ""
        ri = block.find("Rationale")
        if ri != -1:
            rat = " ".join(block[ri+9: ri+9+400].split())
        rec = {
            "section": section,
            "skill": sk[0] if sk else None,
            "domain": sk[1] if sk else None,
            "difficulty": diff_m.group(1).upper() if diff_m else None,
            "correctAnswer": ans_m.group(1).strip() if ans_m else None,
            "rationale": rat or None,
            "sourcePdf": os.path.relpath(path, PDF_BASE),
        }
        # el ANS más específico gana si ya existe (mantener el que tenga más campos)
        if qid not in out or sum(v is not None for v in rec.values()) > sum(v is not None for v in out[qid].values()):
            out[qid] = rec
    return out

# --- recorrer ANS ---
ans_pdfs = [p for p in glob.glob(os.path.join(PDF_BASE, "**", "*.pdf"), recursive=True)
            if os.path.basename(p).upper().startswith("ANS")]
print(f"PDFs ANS a procesar: {len(ans_pdfs)}", file=sys.stderr)
meta = {}
for j, p in enumerate(sorted(ans_pdfs)):
    try:
        for qid, rec in parse_pdf(p).items():
            if qid not in meta or sum(v is not None for v in rec.values()) > sum(v is not None for v in meta[qid].values()):
                meta[qid] = rec
    except Exception as e:
        print(f"  ERR {os.path.basename(p)}: {e}", file=sys.stderr)
    if (j+1) % 20 == 0:
        print(f"  ...{j+1}/{len(ans_pdfs)} PDFs, {len(meta)} preguntas", file=sys.stderr)

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "ans_metadata.json"), "w") as f:
    json.dump(meta, f, indent=1)

# --- reporte de cobertura vs candidatos ---
cand_qids = set(cand_by_qid.keys())
ans_qids = set(meta.keys())
matched = cand_qids & ans_qids
print("\n=== COBERTURA ===")
print(f"Preguntas extraídas de ANS (qids):      {len(ans_qids)}")
print(f"Candidatos PS con questionExternalId:   {len(cand_qids)}")
print(f"  con match en ANS:                     {len(matched)}")
print(f"  SIN match en ANS:                     {len(cand_qids - ans_qids)}")

# completitud de lo extraído
def pct(n): return f"{n} ({100*n//max(len(meta),1)}%)"
print("\n=== COMPLETITUD de los extraídos ===")
for k in ["section","skill","domain","difficulty","correctAnswer","rationale"]:
    print(f"  {k:14}: {pct(sum(1 for r in meta.values() if r.get(k)))}")

# mismatches taxonomía: ANS vs folder-derived del candidato
mm_skill = mm_domain = mm_diff = 0
samples = []
for qid in matched:
    a = meta[qid]; c = cand_by_qid[qid]  # c: (qid, id, folderDomain, folderSkill, section, diff)
    if a["skill"] and norm(a["skill"]) != norm(c[3]): mm_skill += 1;
    if a["domain"] and norm(a["domain"]) != norm(c[2]): mm_domain += 1
    if a["difficulty"] and a["difficulty"] != (c[5] or ""): mm_diff += 1
    if len(samples) < 8 and a["skill"] and norm(a["skill"]) != norm(c[3]):
        samples.append((qid, f"ANS:{a['domain']}/{a['skill']}", f"FOLDER:{c[2]}/{c[3]}", a["sourcePdf"]))
print("\n=== MISMATCH ANS vs carpeta (candidato) ===")
print(f"  skill distinto:      {mm_skill}")
print(f"  domain distinto:     {mm_domain}")
print(f"  difficulty distinto: {mm_diff}")
if samples:
    print("  --- ejemplos skill distinto ---")
    for s in samples: print("   ", s)

print(f"\nJSON: {os.path.join(OUT,'ans_metadata.json')}")
