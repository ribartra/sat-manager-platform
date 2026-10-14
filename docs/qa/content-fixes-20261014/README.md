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

## Round 2 — TEST 5–7 (same day)
Three agents (one per test) with the round-1 lessons added (explanation shift by meaning, missing opening sentences,
shortened options, OCR vs page image). `spec-r2.json` = `specs/test-05/06/07.json` + `specs/extra-r2.json`
(`build-extra-r2.cjs`): 89 ops (9 bleed, 1 options_in_stem, 4 flattened_table, 75 other). Applied dev.db
(backup `backups/devdb-pre-content-fixes-20261014-r2.db`) and prod (`/db/backups/dev.db.pre-content-fixes-20261014-r2`):
89 PENDING → apply → 89 ALREADY, integrity ok.
- No explanation shift in TEST 5–7; all keys match the answer key docs.
- Bleeds: T5 R&W M1 #13; T6 R&W M1 #6/#14/#16/#18/#24, M2 #7 (option A was a copy of the passage — A is the key), M2 #22;
  T7 R&W M1 #9.
- T5 Math M1 #3: options were `[tbl-N.html]` placeholders → pipe tables; option images dropped (image A showed B's table).
- T6/T7 Math explanations with the Word equations stripped ("If , then …") rebuilt from the docx (T6 M1 #14/#18,
  T7 M1 #22, M2 #2/#16/#21). The same defect exists in ~23 practice-set explanations and 1 TEST 8 Math (not fixed yet).
- T5 Math M1 #22 explanation rewritten (old derivation contradicted the figure); T6 R&W M2 #15 A "change" → "charge".
- T6 Math M2 #4 flagged as "MC without options" is NUMERIC with key 29 in the DB — no defect.

## Round 3 — TEST 8–10 (same day)
Three agents, same brief plus stripped-equation explanations. `spec-r3.json` = `specs/test-08/09/10.json` +
`specs/extra-r3.json` (`build-extra-r3.cjs`): 85 ops (7 bleed, 6 flattened_table, 9 stripped_math, 63 other).
Prod uses `spec-r3-prod.json`: T8 Math M2 #1 options have different ids in prod (recreated by an earlier API PUT); same text.
Applied dev.db (backup `backups/devdb-pre-content-fixes-20261014-r3.db`) and prod (`/db/backups/dev.db.pre-content-fixes-20261014-r3`):
85 PENDING → apply → 85 ALREADY, integrity ok.
- No explanation shift in TEST 8–10; all keys match the answer key docs.
- T8 Math M1 #19: stem misread ((a^2)^-2, c^{3/2} denominator) and key option C misread (b^10/a^13) — as stored no option
  was correct; fixed from the page image. T8 Math M1 #16 t/5,730.
- Bleeds: T8 R&W M1 #1; T9 R&W M1 #13 (option D), #15, #21, M2 #14, #24; T10 R&W M1 #7 (option D).
- Stripped-equation explanations rebuilt: T8 M1 #3/#19/#21/#22, M2 #8; T9 M1 #19; T10 M1 #20, M2 #13/#17.
- Missing explanations added: T9 Math M2 #14/#15/#20 (docx); T9 M1 #21 (explanation argued D, key C) and #22 written from the graphs.
- Tables: T8 Math M2 #18, T10 Math M1 #21; T8 Math M2 #1 options as two-line systems.
- Left as is (source cut off): T9 R&W M1 #11 ending, T10 R&W M2 #9 Text 2 ending, T10 R&W M1 #24 / T7 R&W M1 #26 "notes:" intro.
