# PS Geometry and Trigonometry — stripped-math explanations (2026-10-14)

Scope: 12 heuristic candidates from `psx/geo.json`. Read-only on dev.db; ops in `specs/ps-geo.json` (12 guarded ops, class `stripped_math`).

**Result: 12 fixed / 0 false positive / 0 needs_review.**

Sources: the `IngestQuestionCandidate.explanation` rows are identical to the stripped DB text (no LaTeX), and the `ANS …pdf` page artifacts are `PDF_TEXT` (no math). Every restore was therefore transcribed from the rendered ANS PDF page (`pdftoppm -r 110`, 200 dpi crop for HARD #8).

Checks on each op: `before` is the exact DB value; `after` with `$…$` removed, after collapsing whitespace, is identical to `before` (prose unchanged word for word); the dollar signs are balanced; all 188 inline expressions render with KaTeX (`throwOnError`); the conclusion matches `correctAnswer`. Hard PDF line breaks were joined. The paragraph breaks are the same as the source: one per "Choice …" paragraph, plus "Note that …" in LAT HARD #12. Notation: `^\circ`, `\pi`, `\angle`, `\widehat{AC}` for arcs (same as the existing stem of Circles EASY #2), `\overline{OC}`.

| Set / # | Question id | ANS PDF page (Question ID) | Restored | Key check |
|---|---|---|---|---|
| Area and volume EASY #10 | cmsjrnzyb02epqmt1fpnmbg18 | ANS Area and Volume Easy p10 (0e40dfb0) | ℓw, 3, 39, 3·39 | D = 3·39 ✓ |
| Area and volume MEDIUM #10 | cmsjrnzr402csqmt1frwspnyz | ANS Area and Volume MED p11 (38517165) | 31, 2πr, 2r, 31π=2πr, 31=2r | 31 ✓ |
| Circles EASY #2 | cmsjro0jq02o9qmt1622n8v5v | ANS Circles EASY p2 (23c5fcce) | ∠AOC, 90°, arc AC, 90/360×36=9, 1/4, 1/3, 1/2 | A = 9 ✓ |
| Circles HARD #11 | cmsjro0ym02ukqmt1zm4p2vnm | ANS Circles HARD p11 (ab176ad6) | (x−a)²+(y−b)²=r², (a,b), √121 | 11 ✓ |
| Circles HARD #13 | cmsjro0yu02umqmt1678vv1mk | ANS Circles HARD p13 (35d37640) | 1, G, H, (0,0), (−1,y), FG, GH, π, 2π, 25π, choice points | D = 25π ✓ |
| Circles HARD #15 | cmsjro0z402uoqmt15f1z1kge | ANS Circles HARD p15 (69b0d79d) | 30°, x°, 180° equations, 2π/3, arc AB, OC, (2π/3)(18), 12π | B = 12π ✓ |
| Circles MEDIUM #7 | cmsjro05y02hhqmt1z27xhrx5 | ANS Circles MED p7 (8e7689e0) | π, 180°, 720°, 4π | 4 ✓ |
| Lines, angles, and triangles EASY #1 | cmsjro0rs02r3qmt1wn9gbsj6 | ANS Lines Angles Triangles EASY p1 (5207e508) | m, n, t, 170°, w°=170°, 170 | D = 170 ✓ |
| Lines, angles, and triangles HARD #12 | cmsjrnzx502dvqmt1vvfsd1x3 | ANS Lines Angles Triangles HARD p12 (bd7f6e30) | RT=TU, △RTU, ∠TRU/∠TUR/∠SUV/∠VSU/∠STR/∠SVR, 114°+2t°=180°, t=33, 31°+33°=64° | C = 64 ✓ |
| Lines, angles, and triangles HARD #8 | cmsjrnzw402drqmt1aassoc9v | ANS Lines Angles Triangles HARD p8 (17912810) | 101/2, q/r/s/t, a°, b°, w°, angle arithmetic, 2w=101 | 101/2 \| 50.5 ✓ |
| Right triangles and trig EASY #3 | cmsjro01p02ggqmt1k54mow12 | ANS Right Triangles and Trig EASY p3 (36661021) | r²+s²=t², 9, 6, c, 9²+6²=c², 117=c², ±√117, √117, 10.8167, 10.8 | B = 10.8 ✓ |
| Right triangles and trig EASY #4 | cmsjro01u02ghqmt1h6yc6n9h | ANS Right Triangles and Trig EASY p4 (145337bc) | 24, x | A = 24 ✓ |

Notes:
- Source quirk kept as is in LAT HARD #8: "…between lines $q$ and $t$ formed by lines $t$ and $r$" (that is the source wording).
- Prose items such as "x-coordinate", "a, b, and r", "RU", "angle AOB" and "value of x" were plain text in the DB, so they were left as plain text.
- Build script: scratchpad `ps-geo/build.cjs` (read-only DB access).
