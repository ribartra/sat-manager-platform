# PS round 2: Geometry and Trigonometry (Math) findings

Area `geo`: `filterSets(resolveMathPracticeSets(db), {domain:"Geometry and Trigonometry"})`.
That is 12 sets and 142 questions:

- Area and volume: EASY 13, MEDIUM 17, HARD 13
- Circles: EASY 3, MEDIUM 11, HARD 16
- Lines, angles, and triangles: EASY 17, MEDIUM 11, HARD 12
- Right triangles and trigonometry: EASY 4, MEDIUM 8, HARD 17

dev.db was opened read-only. All 142 questions are in `checkpoints/ps2-geo.jsonl`.
The session was interrupted after the checkpoint and spec were written. Both were then re-validated against dev.db before this report was written (see "Spec validation").

## Counts by class

| class | questions | ops |
| --- | --- | --- |
| stripped_math (math dropped from the stem or explanation, restored from the rendered ANS page) | 14 | 15 |
| stripped_math + explanation_truncated (page-break cut tail, plus stripped math in the same field) | 2 | 2 |
| footer_leak (stray trailing `#` from the page footer) | 1 | 1 |
| neighbour bleed / concatenation | 0 | 0 |
| options in stem / fewer than 4 options / paraphrased options | 0 | 0 |
| flattened tables | 0 | 0 |
| header dump / explanation shifted against the key | 0 | 0 |
| wrong key | 0 | 0 (keys are never changed) |

Totals: 125 clean, 17 fixed, 0 needs_review. Spec: `specs/ps2-geo.json` (18 ops: 17 `explanation`, 1 `stem`, all on `Question`).

## Truncation seeds (page-break cuts)

All 3 seeds from `trunc-seeds.json` ("Geometry and Trigonometry") are resolved:

| seed | id | resolution |
| --- | --- | --- |
| Area and volume HARD #11 (93de3f84) | cmsjro04y02h0qmt1751fydh5 | The text was complete, and the seed hit was only the trailing `#` page-footer leak. That `#` is removed. The ANS rationale ends at "…from a conceptual error." |
| Lines, angles, and triangles EASY #6 (3563d76d) | cmsp3qmp900000vmtxd0qyfzc | Restored the tail "from calculation errors." and the stripped proportion $\frac{555}{300} = \frac{c}{16}$, $c = 29.6$ (555·16/300 = 29.6). |
| Area and volume HARD #9 (f7e626b2) | cmsp5xn8500000vo0g76v9z25 | Restored the tail (the rest of Choice A, then Choices B and C) and the surface-area sums $2(4\cdot5)+2(5\cdot6)+2(4\cdot6)$ = $2(20)+2(30)+2(24)$ = 148. |

## Fixes

Source pages were checked on the rendered ANS PDF page (`pdftoppm -r 110`).

| set / # | id | field | class | restored | source |
| --- | --- | --- | --- | --- | --- |
| Area and volume EASY #1 | cmsjrnzxe02e1qmt1yeq5hv36 | explanation | stripped_math | $\ell wh$, $(6)(2)(3)$ | ANS Area and Volume Easy p2 (d683a9cc) |
| Area and volume EASY #3 | cmsjrnzxo02ebqmt17jl6uxl7 | stem | stripped_math | segment names, $DE = 2AB$ | ANS Area and Volume Easy p4 (0837c3b9) |
| Area and volume EASY #3 | cmsjrnzxo02ebqmt17jl6uxl7 | explanation | stripped_math | $DE = 2AB$ | ANS Area and Volume Easy p4 (0837c3b9) |
| Area and volume MEDIUM #1 | cmsjrnzq302cgqmt1s3y0hqw3 | explanation | stripped_math | $V = 7\pi k^3/48$ and the three solution steps | ANS Area and Volume MED p2 (37dde49f) |
| Area and volume MEDIUM #7 | cmsjrnzqv02cqqmt1up27iunj | explanation | stripped_math | radius, volume formula, substitution, result | ANS Area and Volume MED p9 (151eda3c) |
| Area and volume MEDIUM #13 | cmsjrnzrt02d1qmt1jz7a7g4n | explanation | stripped_math | $(4)(9)(10) = 360$ | ANS Area and Volume MED p16 (ec5d4823) |
| Area and volume MEDIUM #14 | cmsjrnzs002d2qmt123n5ui75 | explanation | stripped_math | $V$, $s$, 41, $41^3$, 68,921 | ANS Area and Volume MED p17 (e336a1d2) |
| Area and volume HARD #9 | cmsp5xn8500000vo0g76v9z25 | explanation | stripped_math+explanation_truncated | surface-area sums plus the cut tail | ANS Area and Volume HARD p10 (f7e626b2) |
| Area and volume HARD #11 | cmsjro04y02h0qmt1751fydh5 | explanation | footer_leak | removed the trailing `#` | ANS Area and Volume HARD p13 (93de3f84) |
| Lines, angles, and triangles EASY #6 | cmsp3qmp900000vmtxd0qyfzc | explanation | stripped_math+explanation_truncated | proportion, $c = 29.6$, cut tail | ANS Lines Angles Triangles EASY p7 (3563d76d) |
| Lines, angles, and triangles EASY #7 | cmsjro0se02rpqmt1p4tbrst9 | explanation | stripped_math | $x = 100$ and the two angle subtractions | ANS Lines Angles Triangles EASY p8 (dfc420b2) |
| Lines, angles, and triangles EASY #10 | cmsjro0ss02s4qmt1imesn9lx | explanation | stripped_math | line $\ell$ (twice) | ANS Lines Angles Triangles EASY p11 (992f4e93) |
| Lines, angles, and triangles EASY #14 | cmsjro0tb02sgqmt1dfmcyvz7 | explanation | stripped_math | line $\ell$ (twice) | ANS Lines Angles Triangles EASY p15 (3828f53d) |
| Lines, angles, and triangles HARD #6 | cmsjrnzu102dqqmt1kmsxcyjc | explanation | stripped_math | $\frac{6}{8} = \frac{DC}{6}$, $DC = 4.5$ | ANS Lines Angles Triangles HARD p7 (6a3fbec3) |
| Right triangles and trig EASY #1 | cmsjro01k02gbqmt1e1od4uks | explanation | stripped_math | $x^\circ$, 63, 73, $\sin x^\circ = \frac{63}{73}$ | ANS Right Triangles and Trig EASY p2 (a6097ec2) |
| Right triangles and trig MEDIUM #6 | cmsjro01402g4qmt19upecd83 | explanation | stripped_math | $\tan(A) = \frac{20}{21}$ | ANS Right Triangles and Trig MED p7 (902dc959) |
| Right triangles and trig MEDIUM #7 | cmsjro01a02g9qmt1zds7x4ms | explanation | stripped_math | $Z$, $X$, $Y$, $\cos Y$, $\sin X$ | ANS Right Triangles and Trig MED p8 (659cb706) |
| Right triangles and trig HARD #4 | cmsjro09f02jlqmt1gn1daxym | explanation | stripped_math | $\frac{a}{b}$, $\frac{b}{a}$, $\frac{\sqrt3}{3}$, $\frac{3}{\sqrt3}$ | ANS Right Triangles and Trig HARD p5 (92eb236a) |

`#` is the 0-based `order` in the set, the same as the checkpoint.

## Spec validation

Run read-only against dev.db with scratchpad `ps2/geo/validate.cjs`. Result: 0 problems.

- All 18 `before` values equal the current DB value, and every `after` differs from its `before`.
- `$` is balanced in every `after`, with `\$` treated as a literal. Every inline and display expression renders with KaTeX (`throwOnError`), and none is empty.
- There is one op per (table, id, field), and no op touches `correctAnswer`.
- Checkpoint and spec agree:
  - every `fixed` line's ops are in the spec;
  - every spec op is referenced by a `fixed` line;
  - no `clean` line has ops.
- Prose invariance: with the math removed and whitespace collapsed, each `after` is identical to its `before`. The only exceptions are the intended changes: the two restored tails and the removed `#`.

## needs_review

None.

## Method and what was found clean

- **Sources.** Each question was joined to its ANS rationale by Question ID hex. The checks used `pdftotext` text of every Geometry ANS PDF plus the ingest candidates.
  - The ANS text layer drops math entirely. Every restored expression was therefore transcribed from the rendered page, not from the text layer.
- **Checks run on all 142 questions:**
  - rationale word and number coverage (DB explanation vs ANS);
  - image-gap alignment, to find math gaps in the stem and explanation;
  - stem and option comparison against the source;
  - a tail check for page-break cuts;
  - pattern scans: bleed/`Question ID`, `Question Difficulty:`, trailing `#`, page numbers, `A)`/`×` option lines, `[tbl`, Unicode math-italic, empty `$$`, dangling "is ." / "yields ." gaps.
- **Clean (125):**
  - Stems and options match the source. The set has 104 MC questions, all with 4 options, and 38 NUMERIC questions, with none.
  - No neighbour bleed, no flattened tables, no header dumps.
  - Every explanation's conclusion agrees with `correctAnswer`.
  - A final scan of the clean questions for leftover stripped-math gaps or footer artifacts found 0 real hits; the 1 heuristic hit was a false positive.
- **Already applied, left alone:** the 12 round-1 stripped-math fixes in `specs/ps-geo.json` (see `ps-geo-findings.md`) are applied and were not touched. No Geometry question is in `specs/ps-trunc.json`.
