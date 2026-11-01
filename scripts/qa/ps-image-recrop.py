#!/usr/bin/env python3
"""Re-crop practice-set images (Math + Reading) at the best quality the source allows (read-only on the DB).

Practice-set sources are College Board question-bank PDFs: figures are either VECTOR drawings (render the same
region at 300-400 dpi = real new detail) or EMBEDDED RASTER images (the best is the native image 1:1; rendering
would only resample). Each current image is located on its source page by multi-scale NCC (helpers from
fpt-image-native-recrop.py), the match is classified as RASTER or VECTOR, and the same region is re-produced.

Usage:
  python3 scripts/qa/ps-image-recrop.py --db dev.db --out scratchpad/ps-native [--only id,id]
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import io
import json
import math
import sqlite3
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("fptrecrop", ROOT / "scripts/qa/fpt-image-native-recrop.py")
fpt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fpt)

RENDER = 3.0  # px/pt of the search surface
ACCEPT_NCC = 0.85
MAX_SECOND = 0.75
# Framing fixes decided during review: questionId -> {edge: pt}
FRAMING = {"cmsjro2aw03iuqmt1cs6rep55": {"y1": 452.5}}  # Reading CE MED #16: drop the passage sliver at the bottom


def match(old: Image.Image, surface: Image.Image) -> dict | None:
    """NCC of `old` over a page render; scale = render px / old px (old px per pt in 0.68..4.4 → 0.68..4.4 here)."""
    k = min(1.0, 120 / old.width)
    tc = fpt.gray(old.resize((max(8, round(old.width * k)), max(8, round(old.height * k))), Image.LANCZOS))
    best = None
    maps = []
    for s in np.geomspace(0.6, 3.6, 48):
        f = k / s
        sw, sh = round(surface.width * f), round(surface.height * f)
        if sw <= tc.shape[1] + 2 or sh <= tc.shape[0] + 2:
            continue
        m = fpt.ncc_map(fpt.gray(surface.resize((sw, sh), Image.BOX)), tc)
        y, x = np.unravel_index(int(m.argmax()), m.shape)
        v = float(m[y, x])
        maps.append(v)
        if best is None or v > best[0]:
            best = (v, float(s), int(x), int(y), m)
    if not best:
        return None
    v0, s0, x0, y0, m0 = best
    second = fpt.second_peak(m0, y0, x0, tc.shape[0], tc.shape[1])
    tf = fpt.gray(old)
    cx, cy = (x0 / k) * s0, (y0 / k) * s0
    bf = None
    for s in np.arange(s0 * 0.97, s0 * 1.03, s0 * 0.004):
        ww, wh = old.width * s, old.height * s
        mx, my = ww * 0.15 + 8, wh * 0.15 + 8
        x1, y1 = max(0, int(cx - mx)), max(0, int(cy - my))
        x2, y2 = min(surface.width, int(cx + ww + mx)), min(surface.height, int(cy + wh + my))
        crop = surface.crop((x1, y1, x2, y2))
        cw, ch = round(crop.width / s), round(crop.height / s)
        if cw <= tf.shape[1] or ch <= tf.shape[0]:
            continue
        m = fpt.ncc_map(fpt.gray(crop.resize((cw, ch), Image.LANCZOS)), tf)
        y, x = np.unravel_index(int(m.argmax()), m.shape)
        if bf is None or m[y, x] > bf[0]:
            bf = (float(m[y, x]), float(s), x1 + x * s, y1 + y * s)
    if not bf:
        return None
    v, s, nx, ny = bf
    return {"ncc": v, "second": second, "scale": s, "rect": pymupdf.Rect(nx / RENDER, ny / RENDER,
            (nx + old.width * s) / RENDER, (ny + old.height * s) / RENDER)}


def rows(db: sqlite3.Connection) -> list[dict]:
    sql = """
      SELECT q.id qid, q.imageUrl url, NULL optId, NULL label, sec.name section, d.name domain, ps.name ps, p."order" ord
      FROM Question q JOIN PracticeSetQuestion p ON p.questionId=q.id JOIN PracticeSet ps ON ps.id=p.practiceSetId
      JOIN Topic t ON t.id=ps.topicId JOIN Domain d ON d.id=t.domainId JOIN Section sec ON sec.id=d.sectionId
      WHERE q.imageUrl IS NOT NULL
      UNION ALL
      SELECT o.questionId, o.imageUrl, o.id, o.label, sec.name, d.name, ps.name, p."order"
      FROM QuestionOption o JOIN PracticeSetQuestion p ON p.questionId=o.questionId JOIN PracticeSet ps ON ps.id=p.practiceSetId
      JOIN Topic t ON t.id=ps.topicId JOIN Domain d ON d.id=t.domainId JOIN Section sec ON sec.id=d.sectionId
      WHERE o.imageUrl IS NOT NULL ORDER BY 7, 8, 4"""
    out = [dict(r) for r in db.execute(sql)]
    return [r for r in out if r["domain"] in ("Algebra", "Advanced Math", "Geometry and Trigonometry",
                                              "Problem-Solving and Data Analysis", "Information and Ideas", "Craft and Structure")]


def source_pages(db: sqlite3.Connection, qid: str) -> tuple[Path | None, list[int], str | None]:
    c = db.execute("""SELECT c.questionExternalId hex, f.path, p.pageNumber FROM IngestQuestionCandidate c
                      JOIN IngestSourceFile f ON f.id=c.sourceFileId LEFT JOIN IngestPageArtifact p ON p.id=c.pageArtifactId
                      WHERE c.officialQuestionId=? AND f.isAnswerFile=0 ORDER BY c.updatedAt DESC""", (qid,)).fetchone()
    if not c:
        return None, [], None
    path = fpt.repo_path(c["path"])
    pages: set[int] = set()
    if path.exists() and c["hex"]:
        doc = pymupdf.open(path)
        for i, page in enumerate(doc):
            if page.search_for(c["hex"]):
                pages.update({i + 1, i + 2})
    if c["pageNumber"]:
        pages.update({c["pageNumber"] - 1, c["pageNumber"], c["pageNumber"] + 1})
    return path, sorted(p for p in pages if p >= 1), c["hex"]


def produce(doc: pymupdf.Document, pno: int, rect: pymupdf.Rect, old: Image.Image, reading: bool) -> dict:
    page = doc[pno - 1]
    area = rect.get_area() or 1
    for info in page.get_images(full=True):
        xref = info[0]
        for irect in page.get_image_rects(xref):
            inter = rect & irect
            if inter.is_empty:
                continue
            ia = inter.get_area()
            if ia / area >= 0.40 and ia / (irect.get_area() or 1) >= 0.60:
                ex = doc.extract_image(xref)
                img = Image.open(io.BytesIO(ex["image"]))
                if info[1]:  # soft mask → flatten on white
                    mask = Image.open(io.BytesIO(doc.extract_image(info[1])["image"])).convert("L").resize(img.size)
                    base = Image.new("RGB", img.size, "white")
                    base.paste(img.convert("RGB"), mask=mask)
                    img, raw = base, None
                else:
                    raw = ex["image"]
                sx, sy = img.width / irect.width, img.height / irect.height
                box = (max(0, round((rect.x0 - irect.x0) * sx)), max(0, round((rect.y0 - irect.y0) * sy)),
                       min(img.width, round((rect.x1 - irect.x0) * sx)), min(img.height, round((rect.y1 - irect.y0) * sy)))
                full = box[0] <= 2 and box[1] <= 2 and box[2] >= img.width - 2 and box[3] >= img.height - 2
                if full and raw is not None:
                    return {"kind": "RASTER", "bytes": raw, "ext": ex["ext"], "w": img.width, "h": img.height,
                            "native_ppi": round(sx * 72)}
                crop = img.convert("RGB").crop(box) if not full else img.convert("RGB")
                buf = io.BytesIO()
                crop.save(buf, "PNG", optimize=True)
                return {"kind": "RASTER", "bytes": buf.getvalue(), "ext": "png", "w": crop.width, "h": crop.height,
                        "native_ppi": round(sx * 72)}
    dpi = 400 if reading else max(300, min(400, math.ceil(2 * old.width / rect.width * 72)))
    pix = page.get_pixmap(clip=rect, dpi=dpi, alpha=False)
    return {"kind": "VECTOR", "bytes": pix.tobytes("png"), "ext": "png", "w": pix.width, "h": pix.height, "dpi": dpi}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="dev.db")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "crops").mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    renders: dict[tuple, Image.Image] = {}
    docs: dict[str, pymupdf.Document] = {}
    manifest = []
    for r in rows(db):
        if args.only and r["qid"] not in args.only.split(","):
            continue
        rec = dict(r)
        old_path = ROOT / "public" / r["url"].lstrip("/")
        if not old_path.exists():
            rec["status"] = "missing_old"; manifest.append(rec); continue
        old = Image.open(old_path).convert("RGB")
        rec["old"] = {"w": old.width, "h": old.height}
        src, pages, hexid = source_pages(db, r["qid"])
        if not src or not src.exists() or not pages:
            rec["status"] = "no_source"; manifest.append(rec); continue
        rec["source"], rec["hex"] = str(src.relative_to(ROOT)), hexid
        doc = docs.setdefault(str(src), pymupdf.open(src))
        best = None
        for pno in pages:
            if pno > doc.page_count:
                continue
            key = (str(src), pno)
            if key not in renders:
                pix = doc[pno - 1].get_pixmap(matrix=pymupdf.Matrix(RENDER, RENDER), alpha=False)
                renders[key] = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            hit = match(old, renders[key])
            if hit and (best is None or hit["ncc"] > best[1]["ncc"]):
                best = (pno, hit)
        if not best:
            rec["status"] = "no_match"; manifest.append(rec); continue
        pno, hit = best
        rect = hit["rect"]
        for edge, val in FRAMING.get(r["qid"], {}).items():
            setattr(rect, edge, val)
        res = produce(doc, pno, rect, old, r["section"] != "MATH")
        rec.update({"page": pno, "ncc": round(hit["ncc"], 4), "second": round(hit["second"], 4),
                    "rect_pt": [round(v, 2) for v in rect], "kind": res["kind"], "dpi": res.get("dpi"),
                    "native_ppi": res.get("native_ppi")})
        if hit["ncc"] < ACCEPT_NCC or hit["second"] > MAX_SECOND:
            rec["status"] = "needs_review"
        elif res["kind"] == "RASTER" and abs(res["w"] / old.width - 1) <= 0.05:
            rec["status"] = "skip_native"
        else:
            rec["status"] = "ok"
        digest = hashlib.sha256(res["bytes"]).hexdigest()[:24]
        name = f"{digest}.{'jpg' if res['ext'] in ('jpeg', 'jpg') else res['ext']}"
        (out / "crops" / name).write_bytes(res["bytes"])
        rec["new"] = {"file": name, "w": res["w"], "h": res["h"]}
        manifest.append(rec)
        print(f"{rec['status']:13} {res['kind']:6} {r['ps'][:58]:58} #{r['ord'] + 1:<3}{r['label'] or '-'} "
              f"p{pno} ncc={hit['ncc']:.3f} 2nd={hit['second']:.2f} {old.width}->{res['w']}", flush=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, default=str))
    sheets(out, manifest)
    counts: dict[str, int] = {}
    for m in manifest:
        k = f"{m['status']}:{m.get('kind', '-')}"
        counts[k] = counts.get(k, 0) + 1
    print(json.dumps(counts))


def sheets(out: Path, manifest: list[dict], per: int = 8, row_h: int = 230) -> None:
    (out / "sheets").mkdir(exist_ok=True)
    items = [m for m in manifest if m.get("new")]
    for n in range(0, len(items), per):
        chunk = items[n:n + per]
        W = 1500
        sheet = Image.new("RGB", (W, len(chunk) * (row_h + 34)), "white")
        d = ImageDraw.Draw(sheet)
        for i, m in enumerate(chunk):
            y = i * (row_h + 34)
            d.text((6, y + 4), f"[{n + i + 1}] {m['ps'][:70]} #{m['ord'] + 1} {m['label'] or ''} | {m['status']} {m['kind']} "
                   f"ncc={m['ncc']} {m['old']['w']}->{m['new']['w']}px | {m['qid']}", fill="black")
            for j, p in enumerate((ROOT / "public" / m["url"].lstrip("/"), out / "crops" / m["new"]["file"])):
                im = Image.open(p).convert("RGB")
                im.thumbnail((W // 2 - 20, row_h))
                sheet.paste(im, (10 + j * (W // 2), y + 26))
            d.line((0, y + row_h + 32, W, y + row_h + 32), fill=(200, 200, 200))
        sheet.save(out / "sheets" / f"sheet-{n // per + 1:02d}.jpg", quality=88)


if __name__ == "__main__":
    main()
