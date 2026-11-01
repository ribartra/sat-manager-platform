# FPT images — revert of the 2026-10-14 AI attempt + native re-crop

## 1. Revert (`revert-20261014.json`, 52 ops, dev.db only — prod never received the attempt)
`scripts/qa/reprocess-fpt-images-highres.py` (another session, uncommitted) applied 52 image changes to dev.db.
Investigation: 30 harmful (22 Bluebook UI screenshots added to T1 R&W questions with no image, wrong figure on T7 M1 #18,
T5 Math #3 option images re-added after a content fix removed them, 2 tables duplicating the stem text, 1 blurry
upscale) and 22 only upscaled (page rendered at ~545 dpi from ~260 ppi raster sources = interpolation, no new detail).
Root causes: every row counted as "degraded" (padding > 0), "no current image" treated as needing one, Mistral bbox
read at 150 dpi (cache pages are 93 dpi), docx→pdf conversion unused. Reverted to
`scratchpad/fpt-image-quality-20261014/dev.db.before-apply.bak`; afterwards dev FPT image URLs == prod (120).

## 2. Native re-crop (`scripts/qa/fpt-image-native-recrop.py`, `manifest.json`, `spec-native.json`)
FPT sources are PDFs of lossless raster screenshots (~250–265 ppi, no vector, no text layer) and one docx (T1 R&W,
word/media PNGs). The best possible image is the embedded screenshot cropped 1:1. Each current image was located in the
embedded images of its source page(s) by multi-scale normalized cross-correlation and the SAME region was cropped from
the native pixels (no resampling, framing preserved).

| Decision | Count | |
|---|---|---|
| apply | 92 | median ×2.76 more pixels per side (×1.14–×3.70); 2 needs_review approved after visual check (T9 M1 #8 box plot, T9 M2 #4 option C — similar figures on the page) |
| keep_native | 27 | current image already native (incl. the 22 figures restored 2026-09-28 and 2 T1 R&W docx media) |
| keep_old | 1 | T8 R&W M1 #12: crop lost the "WORLD WINE…" title (NCC 0.81) |

T10 Math M1 #8: framing widened, the old crop clipped the "C" label. All 120 pairs reviewed visually (`sheets/`).

| Target | Backup | Result |
|---|---|---|
| dev.db | `backups/devdb-pre-fpt-native-images.db` | revert 52/52, native 92/92, re-run ALREADY, integrity ok |
| prod files | — | 92 PNGs → `/data/uploads/questions/` and `gs://sat-sol-gsc-sat-data/media/questions/` |
| prod DB | `/db/backups/dev.db.pre-fpt-native-images` | 92 PENDING → applied, re-run ALREADY, quick_check ok, health ok, 0 missing files |
