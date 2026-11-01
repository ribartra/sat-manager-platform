# TEST 8 — content audit (bleed / options-in-stem / flattened tables / explanation shift / stripped math)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-08.json` (20 guarded ops: 15 on `Question`, 5 on `QuestionOption`;
every `before` read from DB and asserted equal, no `before===after`, one op per (table,id,field)). Dry-run on a copy of dev.db:
20 PENDING → apply → 20 ALREADY, integrity ok. Built by a scratch script (`build.cjs`); the M1 #4 / M1 #6 seeds
(`specs/test-08-seed.json`) are already applied and not repeated.

Method: full dump of the 98 published questions + their ingest candidates; per-question verbatim comparison of stimulus/stem/options
against `IngestPageArtifact.extractedText` (R&W PDF 37 pp, Math PDF 19 pp) and inspection of neighbouring passages on the same page;
Math pages 1, 3-5, 7-14, 16-19 rendered and read (pp7-8 at 300 dpi), R&W pp24/28 rendered; all 12 Math question images and the R&W
chart/table images opened; every explanation compared with `Test8_RW_Answer_Explanations.docx` / `Test8_Math_Answer_Explanations.docx`
(own question vs Q±1 overlap) and every key with the "Correct Answer"/"Choice X is correct" line of the docx; docx OMML equations
extracted (m:oMath → LaTeX) to find explanations whose math was stripped; every Math key recomputed.

## Counts

| Class | Ops |
|---|---|
| bleed | 1 |
| options_in_stem | 0 (M1 #4 already fixed; no other `×`/`\boxed` remnants) |
| flattened_table | 5 (M2 #18 table; M2 #1 four 2-equation options) |
| explanation_shift | 0 |
| stripped_math | 5 |
| other | 9 (OCR math errors ×3 ops on 2 Qs, plain-text math → LaTeX ×4, R&W layout ×2) |
| needs_review | 0 |

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 1 | `cmsjrnwip0167qmt12sr8cbf9` | bleed | stimulus had Q2's remote-work/corner-office passage (with its own ______ blank) appended after the Debussy passage; removed (Q2 stimulus already holds it) | fix (Question.stimulus) | files_to_load/MOCK EXAMS/TEST 8/READING AND WRITING/TEST 8 R&W MOD 1 AND 2.pdf p1 (IngestPageArtifact): Debussy passage = Q1, millennials/telework passage = Q2 (two passages on one page) |
| R&W M2 | 4 | `cmsojfkp9000u18ppy3lyfgdg` | other | stem kept the PDF column line breaks (renders on 3 lines); joined into one line (text identical) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/READING AND WRITING/TEST 8 R&W MOD 1 AND 2.pdf p21 OCR/page: same sentence as all other words-in-context stems |
| R&W M2 | 8 | `cmsojfkqf001y18ppgsj880tj` | other | spurious stanza break between couplet lines 2 and 3; the source shows the 4 lines as one block (text identical) | fix (Question.stimulus) | files_to_load/MOCK EXAMS/TEST 8/READING AND WRITING/TEST 8 R&W MOD 1 AND 2.pdf p24 (rendered): four consecutive verse lines, no blank line |
| Math M1 | 10 | `cmsnb3g0c000v0mpd7syi3zod` | other | equations typed as plain text; restore as inline math (text identical) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p4 (rendered): 3x+4y=20, y=x(−x−4), (x, y) typeset as math |
| Math M1 | 16 | `cmsnb3g1d001l0mpd1lt129hz` | other | OCR digit loss in exponent: t/0.730 → t/5,730 (carbon-14 half-life; key 5730 depends on it) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p7 rendered at 300 dpi: exponent t over 5,730; docx heading 'c(t) = 4000(0.5)^(t/5730)' |
| Math M1 | 19 | `cmsnb3g20001o0mpdbh9bejs6` | other | OCR misread the expression: (a^2)^{-2} → (a^3)^{-2} and denominator c^{3/2} → c^{1/2} (as stored no option was correct) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p8 rendered at 300 dpi; docx explanation Q19 (a-term (a^3)^{-2}/a^6, c-term c^{3/2}c^{-1}/c^{1/2}) |
| Math M1 | 19 | `opt cmsnb3g21001r0mpd0mzsq7ol` | other | option C (the key) OCR'd as b^10/a^13; source shows b^10/a^12 | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p8 rendered at 300 dpi: C = b^10/a^12; docx 'Altogether, the expression is b^10/a^12' |
| Math M2 | 1 | `opt cmsjrnw99011hqmt14n9yibu3` | flattened_table | option A is a 2-equation system flattened onto one line; one equation per line, as math | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p10 (rendered): each option shows two stacked equations |
| Math M2 | 1 | `opt cmsjrnw99011iqmt1zta6fgqt` | flattened_table | option B is a 2-equation system flattened onto one line; one equation per line, as math | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p10 (rendered): each option shows two stacked equations |
| Math M2 | 1 | `opt cmsjrnw99011jqmt1uabkjaqn` | flattened_table | option C is a 2-equation system flattened onto one line; one equation per line, as math | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p10 (rendered): each option shows two stacked equations |
| Math M2 | 1 | `opt cmsjrnw99011kqmt1081517yu` | flattened_table | option D is a 2-equation system flattened onto one line; one equation per line, as math | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p10 (rendered): each option shows two stacked equations |
| Math M2 | 2 | `cmsnb3g2m00280mpd0k0wyj5p` | other | xy-plane, (-3, y) and y typed as plain text; restore as inline math (text identical) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p10 (rendered) |
| Math M2 | 18 | `cmsnb3g4e003z0mpd4udukjcd` | flattened_table | 5-column shirts table flattened into one sentence ('6 / $210.00 / …'); rebuilt as pipe table above the source wording | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p17 (rendered): table Number of shirts / Cost of Shirts / Delivery Cost / Tax / Total Cost, rows 6/15/21; OCR [tbl-0.html] + 'The table above shows…' |
| Math M2 | 19 | `cmsnb3g4i00440mpdfj0egqr8` | other | fraction typed as '(x - k)/(x + k)' and variables as plain text; restore as math (text identical) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p17 (rendered): cos(A) = (x−k)/(x+k) as stacked fraction |
| Math M2 | 22 | `cmsnb3g4v004j0mpdk86h3pmn` | other | '2/3' and b, 2b, c typed as plain text; restore as math (text identical) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 8/MATH/TEST 8 INNOV MATH MOD 1&2.pdf p19 (rendered): stacked fraction 2/3, italic b, 2b, c |
| Math M1 | 3 | `cmsnb3fye00050mpd53sirb23` | stripped_math | explanation lost every Word equation (OMML) (blank gaps where the values belong); rebuilt as LaTeX from the docx, prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx, Question 3 (MODULE 1), m:oMath elements |
| Math M1 | 19 | `cmsnb3g20001o0mpdbh9bejs6` | stripped_math | explanation lost every Word equation (OMML) (blank gaps where the values belong); rebuilt as LaTeX from the docx, prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx, Question 19 (MODULE 1), m:oMath elements |
| Math M1 | 21 | `cmsnb3g2c001y0mpd76881utf` | stripped_math | explanation lost every Word equation (OMML) (blank gaps where the values belong); rebuilt as LaTeX from the docx, prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx, Question 21 (MODULE 1), m:oMath elements |
| Math M1 | 22 | `cmsnb3g2h00230mpdixue08j3` | stripped_math | explanation lost every Word equation (OMML) (blank gaps where the values belong); rebuilt as LaTeX from the docx, prose unchanged; docx typos fixed: 'output of 280' / '280−20' → 260 (the question asks h(t)=260; next step uses 240), and a stray '{1}\sim mx{1}+b' tail dropped | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx, Question 22 (MODULE 1), m:oMath elements |
| Math M2 | 8 | `cmsnb3g3d002t0mpdhh5lit47` | stripped_math | explanation lost every Word equation (OMML) (blank gaps where the values belong); rebuilt as LaTeX from the docx, prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 8/Test8_Math_Answer_Explanations.docx, Question 8 (MODULE 2B), m:oMath elements |

## Checked and clean

- **Answer keys:** 98/98 equal the docx answers (54 R&W, 34 Math MC with a stated letter; the 10 NUMERIC + M1 #17 recomputed:
  15, 131, 0.5, 5730, −9 (A), −6, −4, 7, 4). RW M2 #1 = B and Math M2 #1 = B (earlier fixes) confirmed. Every Math MC key recomputed and correct
  (M1 #19 key C becomes correct only with the fixed expression/option).
- **Explanations:** no shift — all 98 match their own docx entry (similarity 1.00 vs ≤0.37 for neighbours). Math M1 #3's docx heading
  says "expression / equivalent form" but its body (and the question) is the parallel-lines system — consistent, not a shift.
- **Bleed:** only R&W M1 #1 (page 1 holds the Q1 and Q2 passages). All other two-passage pages (pp2, 12-15, 20-21, 23, 30-35) split correctly;
  no neighbour fragments at passage starts, no lost opening sentences or intro lines (all "The following text…" intros present), no option
  holding a passage, no topic annotations or question leads in stems, no escaped blanks left (M2 #11 already `_____`), notes bullets one per line.
- **R&W options** match the OCR word for word (no shortened/paraphrased options).
- **Math:** no `[tbl-N.html]` placeholders, no `w^*`/`^{*}` degree errors. M1 #6 (Aditya table) and M1 #4 already fixed. All 12 Math images are the
  right figures (prism, bar graph, parabola, histogram, tree height, triangle DEF, line a, inequality, plumber scatterplot, lines m/n, exponential, pyramid).
- Prices with single `$` (M2 #1 "$19 … $13", M2 #21 "$4 … $2.50 … $c(s)$") tokenise as prose with the current renderer — no change.
- Minor, left as is: R&W M1 #12 stimulus repeats the table title that is also inside the image; Math M2 #16 stem ends without "?" (same in source).
