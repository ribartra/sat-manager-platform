# PS Problem-Solving and Data Analysis: explanations with stripped math (2026-10-14)

Scope: 24 heuristic candidates from `psx/psda.json`. dev.db was opened read-only. The ops are in `specs/ps-psda.json` (23 guarded ops, class `stripped_math`). The per-question log is in `checkpoints/ps-psda.jsonl`.

**Result: 23 fixed / 0 false positive / 1 needs_review.**

Every candidate was a real defect, including the ones with only 2 heuristic hits.

## Sources
- The `IngestQuestionCandidate.explanation` rows match the stripped DB text and contain no LaTeX.
- The `ANS …pdf` page artifacts are `PDF_TEXT`, so their text has no math.
- Every restored expression was therefore copied by hand from the rendered ANS PDF page (`pdftoppm -r 110`; a 250 dpi crop for Ratios HARD #5). Each page image was checked against its `Question ID <hex>` header.

## Checks on each op
- `before` is the exact DB value. The check was re-run at build time, with no drift.
- `after` with `$…$` removed and whitespace collapsed is identical to `before`, so the prose is unchanged. A hard break after a hyphen (`y-\nintercept`) was joined as `y-intercept`.
- The `$` signs are balanced.
- All 165 inline expressions render with KaTeX (`throwOnError`).
- `tokenizeMathContent` (lib/math-text.ts) finds exactly the intended math tokens, and no stray `$` is left in the prose.
- The conclusion matches `correctAnswer`.
- Hard PDF line breaks were joined. Paragraph breaks are the same as the source: one per "Choice …" paragraph, plus "Alternate approach:" in One-var EASY #7.

## Notation
- Thousands are written as `6{,}424`.
- `\%` is used inside math.
- Units inside formulas use `\text{ kg}`, `\text{ m}^3`, `\text{ centimeters}`.
- Fractions use `\frac`, wrapped in `\left(\right)` where the source shows parentheses.

| Set / # | Question id | ANS PDF page (Question ID) | Restored | Key |
|---|---|---|---|---|
| Inference/MoE EASY #5 | cmsjrnzzf02fgqmt1hph8a39o | ANS Inference Margin Error EASY p5 (0108ac2d) | 38−5.5, 38+5.5 | C ✓ |
| Inference/MoE HARD #1 | cmsjro0j702noqmt1mbo41mn0 | ANS Inference Margin Error HARD p1 (916ffe9b) | 483/803, 6,424, 3,864, 2,560, 1,304 and arithmetic | B = 1,304 ✓ |
| Inference/MoE MEDIUM #2 | cmsjro0gg02krqmt1s31wfjg6 | ANS Inference Margin Error MED p2 (1e562f24) | 0.49, 0.04, 0.45, 0.53 | A ✓ |
| One-var EASY #12 | cmsjro0io02n7qmt1saoknm4e | ANS One Var. Data EASY p13 (6670e407) | mean fractions 388/5, 321/5 | C ✓ |
| One-var EASY #15 | cmsjro0j102nmqmt15f57wmm2 | ANS One Var. Data EASY p16 (a067c926) | 50, 40, 50−40, 10 | D = 10 ✓ |
| One-var EASY #16 | cmsjro0j402nnqmt19tbhmp2b | ANS One Var. Data EASY p18 (79340403) | 30, group 1 | 30 ✓ |
| One-var EASY #7 | cmsjro0i802miqmt1nbi95jnd | ANS One Var. Data EASY p7 (708590d7) | mean fractions 28/7, 16/7 | D ✓ |
| One-var HARD #4 | cmsjrnzz002f0qmt1s9ifqiau | ANS One Var. Data HARD p4 (98958ae8) | 41, x/75=25, x=1,875, y/50=65, y=3,250, (1,875+3,250)/125 | 41 ✓ |
| One-var MEDIUM #2 | cmsjro0vt02swqmt1tz7te094 | ANS One Var. Data MED p3 (8193e8cd) | 1/5 (×2) | 1/5 ✓ |
| One-var MEDIUM #5 | cmsjro0wj02t3qmt1j0b6a9hq | ANS One Var. Data MED p6 (9110c120) | 45/9, 145/10 | A ✓ |
| Percentages EASY #14 | cmsjro08p02j7qmt1ddjbydsd | ANS Percents EASY p14 (8705ecba) | **needs_review** (see below) | C |
| Percentages HARD #7 | cmsjrnzt202dbqmt1pzivfk4d | ANS Percents HARD p7 (0231050d) | ((40−10)/40)(100), p% | 75 ✓ |
| Percentages MEDIUM #8 | cmsjro1v703b2qmt1ehawfbmw | ANS Percents MED p8 (022e9894) | 324, 1,250, 72%, 36%, 900, 1,250(72/100), 900(36/100) | 324 ✓ |
| Probability EASY #6 | cmsjro23e03fhqmt1arg6znlr | ANS Probability EASY p6 (e5b5fbdd) | 4/8, 1/2 | C ✓ |
| Probability MEDIUM #11 | cmsjro18q02wsqmt14tzzxuei | ANS Probability Med p12 (0301c5dc) | 20+5+8+4=37, 5/37 | A ✓ |
| Probability MEDIUM #3 | cmsjro15x02wgqmt14vc11nqr | ANS Probability Med p3 (f8696cd8) | 2/6, 1/3 | B ✓ |
| Ratios HARD #4 | cmsjro19a02x0qmt1szysgyie | ANS Ratios Rates Proport. Units HARD p4 (61f61789) | .32, V=s³, (2.00 centimeters)³, V=8.00, 2.56 g / 8.00 cm³ | .32 ✓ |
| Ratios HARD #5 | cmsjro19d02x1qmt1xhlkopsl | ANS Ratios Rates Proport. Units HARD p5 (7d721177) | 353, kg/m³, 345 kg, density equation, 353x=345, x=345/353, V=s³, ∛(345/353)=s, s≈0.99 | B = 0.99 ✓ |
| Ratios MEDIUM #4 | cmsjro1sx039kqmt16gqcma1p | ANS Ratios Rates Proport. Units MED p4 (eb672707) | 14/3, 3, 1, 14, (14 teaspoons)(1 tablespoon / 3 teaspoons) | 14/3 ✓ |
| Two-var EASY #13 | cmsjro1r9038sqmt19lje3i7n | ANS TWO Var. Data EASY p13 (82aaa0a1) | (0,20), y=5, x=0, x=2.5, −20, −3, −35 | B ✓ |
| Two-var MEDIUM #11 | cmsjro1sd039aqmt18qgr3d06 | ANS TWO Var. Data MED p11 (03a16790) | slope formula, (1,12), (11,4), (4−12)/(11−1), −8/10, −0.8 | B = −0.8 ✓ |
| Two-var MEDIUM #5 | cmsjro1rr038xqmt10mgsbptn | ANS TWO Var. Data MED p5 (3d985614) | (0,1), y=mx+b, y=3.30x+0.82, (0,−3.30), (0,0.82) | C ✓ |
| Two-var MEDIUM #8 | cmsjro1ry038zqmt1x1siifxe | ANS TWO Var. Data MED p8 (f46139df) | 25.5, 8, 8.5, x=25.5, 8.2 | C = 8.2 ✓ |
| Two-var MEDIUM #9 | cmsjro1s10390qmt11dgeqn1n | ANS TWO Var. Data MED p9 (1adb39f0) | x=1 (×3), 12−11 | A = 1 ✓ |

## Needs review
**Percentages EASY #14** (`cmsjro08p02j7qmt1ddjbydsd`)
- The source shows `(0.05)($20)` and `$20 + $1`.
- The same paragraph has prose prices ($20, $20, $1, $21), which must stay as text.
- `MATH_TOKEN_PATTERN` in lib/math-text.ts pairs `$` signs by position and does not treat `\$` as an escape. As a result, `$1. Therefore … is $` and `$, or $` mis-tokenize, whatever delimiter is used for the math (`$…$`, `\(…\)`, `\$` or `\textdollar`). This was tested with `tokenizeMathContent`.
- A fix needs either a renderer escape for prose `$` or permission to change the prose prices.

## Out of scope (seen, not changed; the prose rule applies)
- One-var EASY #15: the source's last paragraph, "Choice C is incorrect. This is the number of students born in July.", is on the next PDF page. It is missing from the DB explanation.
- Two-var MEDIUM #11: the same problem with "Choice D is incorrect. The line of best fit shown has a negative slope, not a positive slope." (next page).
- Both are page-overflow truncations of a final Choice paragraph. They could be appended in a separate `explanation_truncated` pass.

Build: scratchpad `ps-psda/cp.cjs` (per-question checks and checkpoint) and `ps-psda/build.ts` (spec built from the checkpoint file, with drift and tokenizer re-check). Both access the DB read-only.
