# Practice-set images re-cropped at source quality (2026-10-14)

Same treatment as the FPT images (`docs/qa/fpt-image-native/`): every practice-set question/option image is
replaced by the best the source PDF can give. The UI renders images at min(natural size, container width)
(commit 74d515a), so a small native image stays small and is never upscaled.

Tool: `scripts/qa/ps-image-recrop.py` (read-only on the DB). Each current image is located on its exercise-PDF
page by multi-scale NCC (accept NCC ≥ 0.85 and 2nd peak ≤ 0.75, else needs_review), then:

- **VECTOR** (charts, grids, tables, geometry drawn as paths): clip render of the matched rect as PNG —
  Reading 400 dpi, Math clamp(2× current px density, 300, 400) dpi.
- **RASTER** (an embedded image covers the match): the embedded image's native pixels 1:1 (original bytes when
  the whole image is used). `skip_native` when that is already the current size (±5%).

## Result (224 applied: dev.db + prod)

| Area | Vector re-rendered | Raster native | Skipped | Width factor (median) |
|---|---|---|---|---|
| Math (170 Q imgs + 32 option imgs) | 92 (4 options) | 109 (28 options) | 1 (Prob. & cond. prob. EASY #7, already native) | vector ×2.0; raster ×0.84 |
| Reading (23 Command of Evidence charts) | 23 | 0 | 0 | ×2.0 |
| Writing | — no images in DB or in any of the 30 PDFs — | | | |

Raster ×0.84: 73 old images were upscales of 150-ppi JPEGs (blurry); the native image is smaller but sharp.
The other 36 were downscales of ~224-ppi sources and gain detail.

Review: all 225 old|new pairs checked by eye (`sheets/`). Findings:
- 18 needs_review rows were option graphs/tables that look alike (high 2nd peak); match order A–D verified —
  approved, except **Two-variable data MED #2 option B**, which matched option C's table → replaced by the
  embedded image placed at option B (xref 109, `y 4 8 12 16`), verified.
- Reading CE MEDIUM #16 (`cmsjro2aw03iuqmt1cs6rep55`): bottom edge set to 452.5 pt, the old crop included a
  sliver of the passage.
- Several old crops carried artifacts absent from the source (e.g. Linear functions EASY #5 extra horizontal
  line, MED #11 extra vertical line, Circles HARD #12 clipped circle); the new images match the PDF.
- 96-ppi formula images inside a few vector tables are a source limit (kept as rendered).

## Files
- `manifest.json` — one row per image: source, page, rect, kind, dpi/native ppi, ncc, old→new px, status.
- `spec.json` — guarded `imageUrl` ops (dev ids); `spec-prod.json` — same, 4 option ids remapped for prod
  (Nonlinear eq. MED #20 A–D, same before-URL).
- Images: `public/uploads/questions/` (dev), `gs://sat-sol-gsc-sat-data/media/questions/` + VM
  `/data/uploads/questions/` (prod).

## Apply log
- dev: backup `backups/devdb-pre-ps-native-images.db`; 224 PENDING → applied → 224 ALREADY; integrity ok;
  0/343 referenced uploads missing.
- prod: backup `/db/backups/dev.db.pre-ps-native-images`; 224 PENDING → applied → 224 ALREADY; quick_check ok;
  0/343 missing on disk; health ok. No code deploy.
- App check (next dev on a copy): rendered width = min(natural, container) at 1440 and 390 px viewports
  (vector grid 1484→510/323, raster graph 267→267, option graphs 181→181, Reading chart 1824→510/323,
  tiny formula 77→77).

Side note (not changed): `resolveWritingPracticeSets` pairs the wrong ANS PDF for Boundaries H1 → H 2,
H3 → H 2 and Med 2 → Med 1.
