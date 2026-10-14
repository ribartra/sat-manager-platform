#!/usr/bin/env python3
"""Re-crop Full Practice Test images from the NATIVE pixels of their source (read-only on the DB).

The FPT sources are PDFs made of lossless raster screenshots (~250-265 ppi) and one .docx (TEST 1 R&W) whose
word/media PNGs are the screenshots. Rendering a page above its native ppi only interpolates, so the best
possible image is the embedded screenshot itself, cropped 1:1.

For every current FPT image (Question.imageUrl / QuestionOption.imageUrl) this tool locates the current image
inside the embedded screenshots of its source page(s) by multi-scale normalized cross-correlation (NCC), then
crops exactly the same region from the native pixels (no padding, no resampling). The current framing, which
was already reviewed, is preserved.

Usage:
  python3 scripts/qa/fpt-image-native-recrop.py --db dev.db --out scratchpad/fpt-native
Outputs <out>/manifest.json, <out>/crops/*.png, <out>/sheets/sheet-NN.jpg (old | new pairs).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sqlite3
import zipfile
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ACCEPT_NCC = 0.90
MAX_SECOND = 0.75
NATIVE_SCALE = 1.05
PAD = 0.25  # white margin around each search image, as a fraction of its size (crops may overrun the screenshot)


def repo_path(p: str) -> Path:
    if p.startswith("/app/"):
        return ROOT / p[len("/app/"):]
    return Path(p)


def gray(img: Image.Image) -> np.ndarray:
    return np.asarray(ImageOps.grayscale(img.convert("RGB")).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float64)


def ncc_map(search: np.ndarray, tmpl: np.ndarray) -> np.ndarray:
    """Normalized cross-correlation of tmpl over every valid position of search (FFT + integral images)."""
    H, W = search.shape
    h, w = tmpl.shape
    t = tmpl - tmpl.mean()
    tn = np.sqrt((t * t).sum())
    if tn < 1e-6:
        return np.full((H - h + 1, W - w + 1), -1.0)
    fs = (H + h - 1, W + w - 1)
    corr = np.fft.irfft2(np.fft.rfft2(search, fs) * np.fft.rfft2(t[::-1, ::-1], fs), fs)[h - 1:H, w - 1:W]
    ii = np.pad(search.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    ii2 = np.pad((search * search).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    s1 = ii[h:, w:] - ii[:-h, w:] - ii[h:, :-w] + ii[:-h, :-w]
    s2 = ii2[h:, w:] - ii2[:-h, w:] - ii2[h:, :-w] + ii2[:-h, :-w]
    var = np.maximum(s2 - s1 * s1 / (h * w), 1e-6)
    return corr / (tn * np.sqrt(var))


def second_peak(m: np.ndarray, y: int, x: int, h: int, w: int) -> float:
    m = m.copy()
    m[max(0, y - h // 2):y + h // 2 + 1, max(0, x - w // 2):x + w // 2 + 1] = -1
    return float(m.max()) if m.size else -1.0


def padded(img: Image.Image) -> tuple[Image.Image, int, int]:
    px, py = int(img.width * PAD), int(img.height * PAD)
    canvas = Image.new("RGB", (img.width + 2 * px, img.height + 2 * py), "white")
    canvas.paste(img.convert("RGB"), (px, py))
    return canvas, px, py


def match(old: Image.Image, surfaces: list[dict]) -> dict | None:
    """Return the best placement of `old` over the native surfaces: surface, scale (native/old), rect, ncc, second."""
    k = min(1.0, 120 / old.width)  # coarse working scale for the template
    tc = gray(old.resize((max(8, round(old.width * k)), max(8, round(old.height * k))), Image.LANCZOS))
    results = []
    for si, surf in enumerate(surfaces):
        S = surf["padded"]
        for s in np.geomspace(0.8, 4.4, 44):
            f = k / s
            sw, sh = round(S.width * f), round(S.height * f)
            if sw <= tc.shape[1] + 2 or sh <= tc.shape[0] + 2:
                continue
            m = ncc_map(gray(S.resize((sw, sh), Image.BOX)), tc)
            y, x = np.unravel_index(int(m.argmax()), m.shape)
            results.append((float(m[y, x]), si, float(s), int(x), int(y), m))
    if not results:
        return None
    results.sort(key=lambda r: -r[0])
    best = results[0]
    ncc0, si, s0, x0, y0, m0 = best
    # Second-best: another location on the same surface, or the best on any other surface.
    second = second_peak(m0, y0, x0, tc.shape[0], tc.shape[1])
    others = [r[0] for r in results if r[1] != si]
    if others:
        second = max(second, max(others))
    # Refine scale and position at full template resolution around the coarse hit.
    S = surfaces[si]["padded"]
    tf = gray(old)
    cx, cy = (x0 / k) * s0, (y0 / k) * s0  # coarse top-left in native padded pixels
    best_f = None
    for s in np.arange(s0 * 0.97, s0 * 1.03, s0 * 0.005):
        win_w, win_h = old.width * s, old.height * s
        mx, my = win_w * 0.15 + 8, win_h * 0.15 + 8
        x1, y1 = max(0, int(cx - mx)), max(0, int(cy - my))
        x2, y2 = min(S.width, int(cx + win_w + mx)), min(S.height, int(cy + win_h + my))
        crop = S.crop((x1, y1, x2, y2))
        cw, ch = round(crop.width / s), round(crop.height / s)
        if cw <= tf.shape[1] or ch <= tf.shape[0]:
            continue
        m = ncc_map(gray(crop.resize((cw, ch), Image.LANCZOS)), tf)
        y, x = np.unravel_index(int(m.argmax()), m.shape)
        v = float(m[y, x])
        if best_f is None or v > best_f[0]:
            best_f = (v, float(s), x1 + x * s, y1 + y * s)
    if best_f is None:
        return None
    v, s, nx, ny = best_f
    return {"surface": si, "scale": s, "x": nx, "y": ny, "w": old.width * s, "h": old.height * s, "ncc": v,
            "ncc_coarse": ncc0, "second": second}


def pdf_surfaces(path: Path, pages: list[int]) -> list[dict]:
    doc = pymupdf.open(path)
    out = []
    for pno in pages:
        if pno < 1 or pno > doc.page_count:
            continue
        page = doc[pno - 1]
        for info in page.get_images(full=True):
            xref, smask = info[0], info[1]
            pix = pymupdf.Pixmap(doc, xref)
            if smask:
                pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
            if pix.colorspace is None or pix.colorspace.n != 3 or pix.alpha:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix) if pix.colorspace and pix.colorspace.n != 3 else pix
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            if img.width < 200 or img.height < 100:
                continue
            pad_img, px, py = padded(img)
            out.append({"kind": "pdf", "page": pno, "xref": xref, "native": img, "padded": pad_img, "px": px, "py": py})
    return out


def docx_surfaces(path: Path) -> list[dict]:
    out = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.startswith("word/media/") and name.lower().endswith((".png", ".jpg", ".jpeg")):
                img = Image.open(io.BytesIO(z.read(name))).convert("RGB")
                pad_img, px, py = padded(img)
                out.append({"kind": "docx", "media": name, "native": img, "padded": pad_img, "px": px, "py": py})
    return out


def rows(db: sqlite3.Connection) -> list[dict]:
    q = db.execute("""
      SELECT q.id qid, q.imageUrl url, NULL optId, NULL label, f."order" ord, m.name module, m.section section, t.name test
      FROM Question q JOIN FullPracticeTestQuestion f ON f.questionId=q.id
      JOIN FullPracticeTestModule m ON m.id=f.moduleId JOIN FullPracticeTest t ON t.id=m.testId
      WHERE q.imageUrl IS NOT NULL
      UNION ALL
      SELECT o.questionId, o.imageUrl, o.id, o.label, f."order", m.name, m.section, t.name
      FROM QuestionOption o JOIN FullPracticeTestQuestion f ON f.questionId=o.questionId
      JOIN FullPracticeTestModule m ON m.id=f.moduleId JOIN FullPracticeTest t ON t.id=m.testId
      WHERE o.imageUrl IS NOT NULL ORDER BY 8, 6, 5, 4""").fetchall()
    return [dict(r) for r in q]


def source_for(db: sqlite3.Connection, qid: str) -> tuple[Path | None, list[int]]:
    cand = db.execute("""SELECT c.id, c.sourceFileId, p.pageNumber FROM IngestQuestionCandidate c
                         LEFT JOIN IngestPageArtifact p ON p.id=c.pageArtifactId
                         WHERE c.officialQuestionId=? ORDER BY c.updatedAt DESC""", (qid,)).fetchall()
    for c in cand:
        src = db.execute("SELECT path, contentType FROM IngestSourceFile WHERE id=?", (c["sourceFileId"],)).fetchone()
        if not src or src["contentType"] != "FULL_PRACTICE_TEST":
            continue
        pages = {r["pageNumber"] for r in db.execute(
            """SELECT a.pageNumber FROM IngestCandidateImageLink l JOIN IngestImageArtifact a ON a.id=l.imageArtifactId
               WHERE l.candidateId=? AND a.pageNumber IS NOT NULL""", (c["id"],))}
        if c["pageNumber"]:
            pages.add(c["pageNumber"])
        near = sorted({p + d for p in pages for d in (-1, 0, 1)})
        return repo_path(src["path"]), near
    return None, []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="dev.db")
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="comma-separated question ids")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "crops").mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    manifest = []
    cache: dict[tuple, list[dict]] = {}
    for r in rows(db):
        if args.only and r["qid"] not in args.only.split(","):
            continue
        rec = {**r, "field": "QuestionOption.imageUrl" if r["optId"] else "Question.imageUrl"}
        old_path = ROOT / "public" / r["url"].lstrip("/")
        if not old_path.exists():
            rec["status"] = "missing_old"; manifest.append(rec); continue
        old = Image.open(old_path).convert("RGB")
        rec["old"] = {"w": old.width, "h": old.height}
        src, pages = source_for(db, r["qid"])
        if not src or not src.exists():
            rec["status"] = "no_source"; manifest.append(rec); continue
        rec["source"] = str(src.relative_to(ROOT))
        key = (str(src), tuple(pages))
        if key not in cache:
            cache[key] = docx_surfaces(src) if src.suffix.lower() == ".docx" else pdf_surfaces(src, pages)
        surfaces = cache[key]
        hit = match(old, surfaces) if surfaces else None
        if not hit:
            rec["status"] = "no_match"; manifest.append(rec); continue
        surf = surfaces[hit["surface"]]
        rec.update({k: round(v, 4) if isinstance(v, float) else v for k, v in hit.items() if k != "surface"})
        rec["where"] = {"page": surf.get("page"), "xref": surf.get("xref"), "media": surf.get("media")}
        x1, y1 = round(hit["x"]), round(hit["y"])
        crop = surf["padded"].crop((x1, y1, x1 + round(hit["w"]), y1 + round(hit["h"])))
        if hit["ncc"] < ACCEPT_NCC or hit["second"] > MAX_SECOND:
            rec["status"] = "needs_review"
        elif hit["scale"] <= NATIVE_SCALE:
            rec["status"] = "skip_native"
        else:
            rec["status"] = "ok"
        buf = io.BytesIO()
        crop.save(buf, "PNG", optimize=True)
        digest = hashlib.sha256(buf.getvalue()).hexdigest()[:24]
        (out / "crops" / f"{digest}.png").write_bytes(buf.getvalue())
        rec["new"] = {"file": f"{digest}.png", "w": crop.width, "h": crop.height}
        manifest.append(rec)
        print(f"{rec['status']:13} {r['test'][:14]:14} {r['module'][:18]:18} #{r['ord'] + 1:<3} {r['label'] or '-'} "
              f"ncc={hit['ncc']:.3f} 2nd={hit['second']:.2f} x{hit['scale']:.2f} {old.width}->{crop.width}", flush=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, default=str))
    make_sheets(out, manifest)
    counts: dict[str, int] = {}
    for m in manifest:
        counts[m["status"]] = counts.get(m["status"], 0) + 1
    print(json.dumps(counts))


def make_sheets(out: Path, manifest: list[dict], per: int = 8, row_h: int = 230) -> None:
    (out / "sheets").mkdir(exist_ok=True)
    items = [m for m in manifest if m.get("new")]
    for n in range(0, len(items), per):
        chunk = items[n:n + per]
        W = 1500
        sheet = Image.new("RGB", (W, len(chunk) * (row_h + 34)), "white")
        d = ImageDraw.Draw(sheet)
        for i, m in enumerate(chunk):
            y = i * (row_h + 34)
            d.text((6, y + 4), f"[{n + i + 1}] {m['test']} | {m['module']} #{m['ord'] + 1} {m['label'] or ''} | "
                   f"{m['status']} ncc={m['ncc']} x{m['scale']} | {m['qid']}", fill="black")
            old = Image.open(ROOT / "public" / m["url"].lstrip("/")).convert("RGB")
            new = Image.open(out / "crops" / m["new"]["file"]).convert("RGB")
            for j, im in enumerate((old, new)):
                im = im.copy()
                im.thumbnail((W // 2 - 20, row_h))
                sheet.paste(im, (10 + j * (W // 2), y + 26))
            d.line((0, y + row_h + 32, W, y + row_h + 32), fill=(200, 200, 200))
        sheet.save(out / "sheets" / f"sheet-{n // per + 1:02d}.jpg", quality=88)


if __name__ == "__main__":
    main()
