"""Parser + in-place repair for PRACTICE-EXERCISE question candidates.

Los PDF de práctica (los que traen ``Question ID: …``) tienen una estructura de
marcadores muy regular:

    Question ID: 83f2c3bf
    Assessment Test Domain Skill Difficulty      ← cabecera (opcional)
    SAT Math Algebra Linear equations in two Easy
    variables                                    ← cola envuelta del skill
    Question                                     ← encabezado literal
    <ENUNCIADO…>
    Answer
    A. …   B. …   C. …   D. …                    ← alternativas (a veces vacías = imagen)
    Correct Answer: X                            ← (normalmente en el PDF ANS aparte)
    Rationale …

El parser genérico de ``main.py`` fallaba aquí de tres formas:

1. **Número**: la rama por ``Question ID`` nunca asignaba ``questionNumber`` → nulo.
2. **Enunciado**: dejaba la cabecera (``…variables\nQuestion``) y el ``Answer`` final
   pegados al enunciado.
3. **Alternativas**: ``OPTION_RE`` capturaba el artículo «**A** student is writing…»
   como si fuera la alternativa A, porque las alternativas reales solo aparecen
   *después* del marcador ``Answer``.

Este módulo resuelve los tres extrayendo por marcadores. Es **stdlib puro** (sin
FastAPI ni mistral) para poder importarse tanto desde ``main.py`` como desde el
script de reparación en sitio (``python -m app.practice_repair``).

La reparación en sitio toca SOLO ``stem``, ``optionsJson``, ``type`` y
``questionNumber``. NUNCA toca ``correctAnswer`` ni ``explanation`` (enriquecidos
desde los PDF ANS por ``questionExternalId``), ni las imágenes o sus enlaces.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
from typing import Any

# ── Marcadores de la estructura práctica ─────────────────────────────────────
QID_LINE = re.compile(r"(?im)^[*#\s]*(?:Question\s+ID|ID)\s*[:：]?\s*[A-Fa-f0-9]{6,}[*\s]*$")
ASSESSMENT_LINE = re.compile(r"(?im)^[*#\s]*Assessment\s+Test\s+Domain\s+Skill\s+Difficulty[*\s]*$")
SAT_META_LINE = re.compile(r"(?im)^[*#\s]*SAT\s+(?:Math|Reading(?:\s+and\s+Writing)?)\b.*$")
# Encabezado "Question", "**Question**", "# Question" o "Question 27" (numerado).
QUESTION_HEADER = re.compile(r"(?im)^[*#\s]*Question(?:\s+\d{1,3})?[*#\s]*$")
ANSWER_HEADER = re.compile(r"(?im)^\s*#*\s*Answer\s*#*\s*$")
STOP_LINE = re.compile(r"(?im)^\s*#*\s*(?:Correct\s+Answer|Rationale|Question\s+Difficulty)\b")
OPTION_LINE = re.compile(r"(?im)^\s*[×✕✖※*•\-]?\s*([A-D])[.)]\s*(.*)$")
NAV_LINE = re.compile(r"(?im)^\s*(?:PREV\.?\s+QUESTION|NEXT\s+QUESTION|COME?\s+BACK\s+LATER)\s*$")

# Estímulo de R&W: el enunciado arranca con un pasaje ("Text 1", "Text 2",
# "Passage", "The following text…") y termina en un prompt reconocible. El campo
# `stimulus` de la BD existe justo para separar el pasaje de la consigna.
STIMULUS_START = re.compile(
    r"(?im)^[*#\s]*(?:Text\s+\d+|Passage\s+\d+|The\s+following\s+text|The\s+following\s+passage)\b"
)
# Líneas que típicamente inician la consigna (prompt) de una pregunta de R&W.
PROMPT_LEAD = re.compile(
    r"(?i)^\s*(?:As\s+used\s+in\b"
    r"|Based\s+on\b"
    r"|According\s+to\b"
    r"|Which\s+(?:choice|finding|quotation|statement|detail|of\s+the\s+following)\b"
    r"|What\s+(?:is|does|can|was|choice)\b"
    r"|Why\s+(?:does|did|is)\b"
    r"|How\s+(?:does|did|is)\b"
    r"|The\s+(?:author|student|writer|researchers?|passage)\b.*\?"
    r"|Wh(?:ich|at|y|o)\b.*\?)"
)


def _collapse(value: str) -> str:
    value = NAV_LINE.sub("", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def split_stimulus_and_prompt(stem_text: str) -> tuple[str | None, str]:
    """Separa el estímulo (pasaje R&W) de la consigna (prompt).

    Solo actúa cuando el enunciado arranca con un marcador de pasaje
    (``Text 1``/``Passage``/``The following text``). Busca el inicio del prompt
    (última línea con un lead-in conocido o, en su defecto, la última línea que
    termina en «?»). Si no encuentra un prompt confiable, devuelve
    ``(None, stem_text)`` — nunca empeora el enunciado.
    """
    if not stem_text or not STIMULUS_START.match(stem_text.lstrip()):
        return None, stem_text
    lines = stem_text.split("\n")
    prompt_start: int | None = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() and PROMPT_LEAD.match(lines[i]):
            prompt_start = i
            break
    if prompt_start is None:
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip().endswith("?"):
                prompt_start = i
                break
    if prompt_start is None or prompt_start == 0:
        return None, stem_text
    stimulus = _collapse("\n".join(lines[:prompt_start]))
    prompt = _collapse("\n".join(lines[prompt_start:]))
    if not stimulus or not prompt:
        return None, stem_text
    return stimulus[:4000], prompt


def parse_practice_block(text: str) -> dict[str, Any] | None:
    """Extrae {stem, options, image_backed, type} de un bloque de práctica.

    Devuelve ``None`` si el texto no parece un bloque de práctica utilizable
    (sin enunciado tras limpiar los marcadores).
    """
    raw = (text or "").replace("\r", "").strip()
    if not raw:
        return None
    lines = raw.split("\n")

    def find(pat: re.Pattern[str]) -> int | None:
        return next((i for i, ln in enumerate(lines) if pat.match(ln)), None)

    qi = find(QUESTION_HEADER)
    ai = find(ANSWER_HEADER)
    si = find(STOP_LINE)

    # Inicio del enunciado: justo después del encabezado "Question"; si no hay,
    # después de la última línea de ruido de cabecera (ID / Assessment / SAT …).
    if qi is not None:
        start = qi + 1
    else:
        start = 0
        for i, ln in enumerate(lines[:8]):
            if QID_LINE.match(ln) or ASSESSMENT_LINE.match(ln) or SAT_META_LINE.match(ln):
                start = i + 1

    # Dónde empiezan las alternativas: preferentemente tras "Answer"; si no,
    # la primera línea "A." que arranca una corrida A-D.
    if ai is not None and ai >= start:
        opt_start: int | None = ai + 1
        stem_end = ai
    else:
        opt_start = None
        for i in range(start, len(lines)):
            m = OPTION_LINE.match(lines[i])
            if m and m.group(1).upper() == "A":
                opt_start = i
                break
        stem_end = opt_start if opt_start is not None else (si if si is not None else len(lines))

    opt_end = si if (si is not None and (opt_start is None or si > opt_start)) else len(lines)

    # ── Enunciado ────────────────────────────────────────────────────────────
    stem_lines = lines[start:stem_end]
    stem = _collapse("\n".join(stem_lines))
    # Restos de cabecera que a veces quedan dentro del rango (envoltura del skill).
    stem = ASSESSMENT_LINE.sub("", stem)
    stem = SAT_META_LINE.sub("", stem)
    stem = QID_LINE.sub("", stem)
    stem = QUESTION_HEADER.sub("", stem)
    stem = _collapse(stem)

    # ── Alternativas ─────────────────────────────────────────────────────────
    options: list[dict[str, str]] = []
    if opt_start is not None:
        current: dict[str, str] | None = None
        seen: set[str] = set()
        for i in range(opt_start, opt_end):
            ln = lines[i]
            m = OPTION_LINE.match(ln)
            if m:
                label = m.group(1).upper()
                if label in seen:
                    current = None
                    continue
                current = {"label": label, "text": m.group(2).strip()}
                options.append(current)
                seen.add(label)
            elif current is not None and ln.strip() and not NAV_LINE.match(ln):
                current["text"] = (current["text"] + " " + ln.strip()).strip()
        options = [{"label": o["label"], "text": o["text"][:2000]} for o in options]

    if not stem and not options:
        return None

    stimulus, stem = split_stimulus_and_prompt(stem)

    image_backed = bool(options) and all(not o["text"] for o in options)
    return {
        "stem": stem[:2500],
        "stimulus": stimulus,
        "options": options,
        "image_backed": image_backed,
        "type": "MC" if options else "NUMERIC",
    }


def assign_sequential_numbers(conn: sqlite3.Connection, batch_id: str | None = None) -> int:
    """Numera 1..N (por archivo, en orden de documento) los candidatos de práctica.

    «Cada conjunto (Question/ANS/explanation) reúne preguntas desde el 1». Solo
    afecta candidatos con ``questionExternalId`` (los de práctica); los mock exams
    conservan su número real. Devuelve cuántas filas cambiaron.
    """
    where = "c.questionExternalId IS NOT NULL"
    params: list[Any] = []
    if batch_id is not None:
        where += " AND c.batchId = ?"
        params.append(batch_id)
    rows = conn.execute(
        f"""
        SELECT c.id, c.sourceFileId, c.questionNumber
        FROM IngestQuestionCandidate c
        LEFT JOIN IngestPageArtifact p ON p.id = c.pageArtifactId
        WHERE {where}
        ORDER BY c.sourceFileId, COALESCE(p.pageNumber, 999999), c.rowid
        """,
        params,
    ).fetchall()
    seq_by_file: dict[str, int] = {}
    updates: list[tuple[int, str]] = []
    for row in rows:
        seq = seq_by_file.get(row["sourceFileId"], 0) + 1
        seq_by_file[row["sourceFileId"]] = seq
        if row["questionNumber"] != seq:
            updates.append((seq, row["id"]))
    conn.executemany("UPDATE IngestQuestionCandidate SET questionNumber = ? WHERE id = ?", updates)
    return len(updates)


# ── Reparación en sitio sobre dev.db ─────────────────────────────────────────
def _db_path(database_url: str | None) -> str:
    url = database_url or os.getenv("DATABASE_URL") or "file:./dev.db"
    return url[5:] if url.startswith("file:") else url


def repair_in_place(db_path: str, *, dry_run: bool = True, limit: int | None = None) -> dict[str, Any]:
    conn = sqlite3.connect(db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")

    rows = conn.execute(
        """
        SELECT c.id, c.sourceFileId, c.questionNumber, c.questionExternalId, c.stem,
               c.stimulus, c.optionsJson, c.type, c.status, c.rawJson,
               p.pageNumber AS pageNumber, c.rowid AS rid
        FROM IngestQuestionCandidate c
        LEFT JOIN IngestPageArtifact p ON p.id = c.pageArtifactId
        WHERE c.questionExternalId IS NOT NULL
        ORDER BY c.sourceFileId, COALESCE(p.pageNumber, 999999), c.rowid
        """
    ).fetchall()

    stats = {
        "considered": len(rows),
        "parsed": 0,
        "stemChanged": 0,
        "optionsChanged": 0,
        "typeChanged": 0,
        "stimulusChanged": 0,
        "imageBacked": 0,
        "unparsed": 0,
    }
    samples: list[dict[str, Any]] = []

    # 1) Numeración secuencial por archivo (1..N en orden de documento).
    seq_by_file: dict[str, int] = {}
    number_updates: list[tuple[int, str]] = []
    field_updates: list[tuple[Any, ...]] = []

    for row in rows:
        seq = seq_by_file.get(row["sourceFileId"], 0) + 1
        seq_by_file[row["sourceFileId"]] = seq
        if row["questionNumber"] != seq:
            number_updates.append((seq, row["id"]))

        raw = {}
        try:
            raw = json.loads(row["rawJson"] or "{}")
        except Exception:
            raw = {}
        parsed = parse_practice_block(raw.get("text") or "")
        if not parsed:
            stats["unparsed"] += 1
            continue
        stats["parsed"] += 1

        new_stem = parsed["stem"] or None
        new_stimulus = parsed["stimulus"] or None
        new_opts = parsed["options"]
        new_opts_json = json.dumps(new_opts, ensure_ascii=False) if new_opts else None
        new_type = parsed["type"]
        if parsed["image_backed"]:
            stats["imageBacked"] += 1

        old_opts_json = row["optionsJson"]
        changed_stem = (new_stem or "") != (row["stem"] or "")
        changed_opts = (new_opts_json or "") != (old_opts_json or "")
        changed_type = new_type != row["type"]
        changed_stimulus = (new_stimulus or "") != (row["stimulus"] or "")
        if changed_stem:
            stats["stemChanged"] += 1
        if changed_opts:
            stats["optionsChanged"] += 1
        if changed_type:
            stats["typeChanged"] += 1
        if changed_stimulus:
            stats["stimulusChanged"] += 1

        if changed_stem or changed_opts or changed_type or changed_stimulus:
            field_updates.append((new_stem, new_stimulus, new_opts_json, new_type, row["id"]))
            if len(samples) < 6 and changed_stem:
                samples.append(
                    {
                        "ext": row["questionExternalId"],
                        "oldStem": (row["stem"] or "")[:110],
                        "newStem": (new_stem or "")[:110],
                        "newOpts": [o["text"][:24] for o in new_opts][:4],
                    }
                )

    stats["numberUpdates"] = len(number_updates)
    stats["fieldUpdates"] = len(field_updates)

    if not dry_run:
        cur = conn.cursor()
        assign_sequential_numbers(conn)  # misma lógica que usa el pipeline
        cur.executemany(
            "UPDATE IngestQuestionCandidate SET stem = ?, stimulus = ?, optionsJson = ?, type = ?, updatedAt = datetime('now') WHERE id = ?",
            field_updates,
        )
        conn.commit()
    conn.close()
    return {"stats": stats, "samples": samples}


def main() -> None:
    ap = argparse.ArgumentParser(description="Repara en sitio los candidatos de práctica (stem/options/type/number).")
    ap.add_argument("--db", default=None, help="Ruta a la BD SQLite (default: DATABASE_URL o ./dev.db)")
    ap.add_argument("--apply", action="store_true", help="Aplica los cambios (por defecto es dry-run).")
    args = ap.parse_args()
    db_path = _db_path(args.db)
    result = repair_in_place(db_path, dry_run=not args.apply)
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] db={db_path}")
    print(json.dumps(result["stats"], indent=2, ensure_ascii=False))
    for s in result["samples"]:
        print("\n---", s["ext"])
        print("  old:", s["oldStem"])
        print("  new:", s["newStem"])
        print("  opt:", s["newOpts"])


if __name__ == "__main__":
    main()
