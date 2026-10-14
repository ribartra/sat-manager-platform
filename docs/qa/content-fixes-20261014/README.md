# Content fixes 2026-10-14 (concatenated questions, options in the stem, flattened tables) — TEST 1–4 + 2 TEST 8 seeds

Trigger: reviewer report (TEST 8 Math M1 #4 showed "× A √35 × B" in the stem; #6 showed a table flattened to one line;
a question carried the next question's content). Four read-only agents audited TEST 1–4 (one per test) against the
ingest source (candidate rows, `IngestPageArtifact.extractedText`, rendered source pages). The source decides which
question a piece of text belongs to.

Specs: `specs/test-0N.json` (+ `specs/test-08-seed.json`, built by `build-seed-t8.cjs`), merged into `spec.json`
(129 guarded ops: 52 bleed, 2 options_in_stem, 3 flattened_table, 72 other). Findings per test: `test-0N-findings.md`.
Apply: `node apply-spec.cjs <db> spec.json [--apply]` (op applies only when the field still equals `before`).

Applied 2026-10-14: dev.db (backup `backups/devdb-pre-content-fixes-20261014.db`) and prod
(backup `/db/backups/dev.db.pre-content-fixes-20261014`); dry-run 129 PENDING in both, apply, re-run 129 ALREADY, integrity ok.

Highlights:
- T2 R&W: explanations shifted by one from M1 #20 to M2 #26 (docx Q20 not in a table) → 34 explanations moved back;
  "Choice X is the best answer" now matches the key on all 54 R&W questions (was 31 mismatches).
- T3 R&W M1 #14/#17/#20: stimulus carried the next two questions' passages. T4 R&W M2 #19/#21/#23/#25: stimulus was a
  neighbour's passage (real passage restored from the source page).
- T1 Math M2 #8: options were #7's fractions (wrong already in the OCR of the page) → restored from the page image.
- Shortened/paraphrased options restored to source wording (T2 Math, T3 R&W/Math); passages missing their opening
  sentence restored (T2, T4); escaped blanks `\_\_\_\_\_` → `_____` (T1–T4 only; ~31 bank-wide).
- needs_review: T3 R&W M1 #24 = M2 #25 (Frances Perkins) — the source PDF repeats it.

Renderer (`lib/math-text.ts`), same day: blank lines next to a `$$…$$` block no longer add an empty line (big gap between
stacked equations, T8 M1 #4); "$25 (Week 1: $200" style prices are prose, not math (140 tokens bank-wide).
