# TEST 7 — content audit (bleed / options-in-stem / flattened tables / explanation shift)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-07.json` (28 guarded ops: 25 on `Question`, 3 on `QuestionOption`; every `before` read from DB and asserted equal, no `before===after`, one op per (table,id,field)).

Method: full dump of all 98 published questions + candidates; per-question verbatim search of stimulus/stem/options in the
source OCR (`IngestPageArtifact.extractedText`, R&W PDF 35 pp, Math PDF 18 pp) and inspection of the text preceding each
stimulus (finds lost lead-ins and appended neighbours); all 18 Math pages and R&W pp15-18 rendered and read
(Math options are images in the OCR, so they were checked visually; M2 p12 re-rendered at 250 dpi); every explanation
compared against `Test7_RW_Answer_Explanations.docx` / `Test7_Math_Answer_Explanations.docx` (same Q vs Q±1 word overlap)
and every key against `TEST 7 ANS KEY.docx`; all 11 question images opened.

## Counts

| Class | Ops |
|---|---|
| bleed | 1 |
| options_in_stem | 1 |
| flattened_table | 0 |
| explanation_shift | 0 |
| other | 26 (truncated lead-ins ×5, intro/passage paragraph break ×3, notes bullets ×6, escaped blank ×1, Math formatting ×7, explanations with lost OMML math ×4) |
| needs_review | 1 (no op) |

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 4 | `cmsjrnwlk016dqmt136bxx94k` | other | stimulus truncated: lead-in "Penicillin, a common antibiotic, was developed in the late 1920s after Dr." dropped (passage started mid-sentence) | fix (Question.stimulus) | IngestPageArtifact p2 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q4 passage) |
| R&W M1 | 6 | `cmsjrnwly016lqmt16nw9dxca` | other | stimulus truncated: intro "The following is adapted from Arthur Conan Doyle's 1891 … "A Scandal in Bohemia."" dropped; intro/passage paragraph break restored | fix (Question.stimulus) | IngestPageArtifact p3 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q6 passage) |
| R&W M1 | 8 | `cmsjrnwmb0171qmt1c23v95x4` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p5 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M1 | 9 | `cmsjrnwmi017bqmt1bpv3sgv7` | bleed | stimulus had Q10's Art of War passage (incl. its "______" blank) appended after the poem; removed it and restored the poem's line/stanza breaks | fix (Question.stimulus) | IngestPageArtifact p6 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf: poem block for Q9, Art of War passage belongs to Q10 (same page); Q10 stimulus already holds it |
| R&W M1 | 16 | `cmsjrnwou018hqmt1lrr54z4g` | other | stimulus truncated: opening sentence "Indigenous to India, the rusty-spotted cat … smallest cat species." dropped ("they" had no referent) | fix (Question.stimulus) | IngestPageArtifact p10 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q16 passage) |
| R&W M1 | 18 | `cmsjrnwp7018lqmt1fjl59nf9` | other | stimulus truncated: opening sentence "Plants rely on a number of nearly invisible tools for their survival." dropped | fix (Question.stimulus) | IngestPageArtifact p11 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q18 passage) |
| R&W M1 | 22 | `cmsjrnwpt018xqmt1fqlh3ksc` | other | stimulus truncated: subject "“Post hoc ergo propter hoc”" dropped (passage began "is a common logical fallacy") | fix (Question.stimulus) | IngestPageArtifact p13 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q22 passage) |
| R&W M1 | 25 | `cmsjrnwsp0193qmt1o7t4skqv` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p15 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M1 | 26 | `cmsjrnwt7019dqmt14cfxvtbt` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p16 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M1 | 27 | `cmsjrnwty019nqmt1tmo3l2en` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p17 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M2 | 2 | `cmson6g1w000518pp9ognfh6z` | other | escaped blank \_\_\_\_\_ renders literally; use _____ | fix (Question.stimulus) | IngestPageArtifact p18 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf (Q2 passage shows _____) |
| R&W M2 | 7 | `cmsjrnwm8016wqmt1j6ur57yy` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M2 | 8 | `cmsjrnwmf0176qmt1mo1aok2h` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p22 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M2 | 25 | `cmsjrnwt00198qmt199lbpf45` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p33 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M2 | 26 | `cmsjrnwtt019iqmt1x1ja4rz6` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p34 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| R&W M2 | 27 | `cmsjrnwu2019sqmt10whohlet` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p35 of files_to_load/MOCK EXAMS/TEST 7/READING AND WRITING/ Test 7 RW.pdf |
| Math M1 | 11 | `cmsjrnwwl01b5qmt1oln4m8lr` | other | escaped dollar "\$2,800" renders with a literal backslash (renderer does not unescape \$); single $ price is prose | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p4 (rendered): "maximum of $2,800" |
| Math M1 | 18 | `cmsjrnwyd01bnqmt1l4vwq4sj` | other | OCR inline-math delimiters "  \( f(x) \) " with stray spaces; normalise to $f(x)$ (table is the image; options clean) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p7 (rendered) |
| Math M1 | 19 | `cmsjrnwym01btqmt1846xul16` | options_in_stem | options A–D left in the stem as OCR "\[ \times \boxed{A} 3 \]…" blocks (× = cross-out UI); options table already holds 3, 3√2, 6, 6√2 | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p7 (rendered): Q19 options panel A 3 / B 3√2 / C 6 / D 6√2 |
| Math M2 | 7 | `opt cmsjrnwvr01avqmt1ywsjoaep` | other | option A uses Unicode superscripts ("y = 200(3)ᵗ"); rewrite as LaTeX like option C | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p12 rendered at 250 dpi: A y=200(3)^t, B y=3(200)^t, C y=200(3)^{t/7}, D y=200^{3t} |
| Math M2 | 7 | `opt cmsjrnwvr01awqmt1rlgb7o3q` | other | option B uses Unicode superscripts ("y = 3(200)ᵗ"); rewrite as LaTeX like option C | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p12 rendered at 250 dpi: A y=200(3)^t, B y=3(200)^t, C y=200(3)^{t/7}, D y=200^{3t} |
| Math M2 | 7 | `opt cmsjrnwvr01ayqmt1nv6p0vzt` | other | option D uses Unicode superscripts ("y = 200³ᵗ"); rewrite as LaTeX like option C | fix (QuestionOption.text) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p12 rendered at 250 dpi: A y=200(3)^t, B y=3(200)^t, C y=200(3)^{t/7}, D y=200^{3t} |
| Math M2 | 8 | `cmsjrnww001b0qmt192ba8rnz` | other | system typed as plain text with slash fractions; restore as math ($$…\frac{2}{3}$$, $$…\frac{1}{12}$$) | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p12 (rendered): stacked fractions 2/3 and 1/12 |
| Math M2 | 13 | `cmsjrnwxb01baqmt1s1u8sv5b` | other | inline math wrapped in display $$…$$ (breaks the sentence into blocks, "xy" on its own line); use inline $…$ | fix (Question.stem) | files_to_load/MOCK EXAMS/TEST 7/MATH/TEST 7 INNOVATOR MATH.pdf p14 (rendered): equation inline in the sentence |
| Math M1 | 22 | `cmsjrnx2701c2qmt18m37uycw` | other | explanation lost every Word-equation (OMML) value ("If , then the –value for  when  is .") — restored with LaTeX from the docx equations; prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 7/Test7_Math_Answer_Explanations.docx, table for Question 22 (MODULE 1), m:oMath elements |
| Math M2 | 2 | `cmsjrnwuo01a8qmt11c9v1qtn` | other | explanation lost every Word-equation (OMML) value ("If , then the –value for  when  is .") — restored with LaTeX from the docx equations; prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 7/Test7_Math_Answer_Explanations.docx, table for Question 2 (MODULE 2B), m:oMath elements |
| Math M2 | 16 | `cmsjrnwy001bgqmt1mj7a9ibd` | other | explanation lost every Word-equation (OMML) value ("If , then the –value for  when  is .") — restored with LaTeX from the docx equations; prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 7/Test7_Math_Answer_Explanations.docx, table for Question 16 (MODULE 2B), m:oMath elements |
| Math M2 | 21 | `cmsjrnx1k01c1qmt111g85jey` | other | explanation lost every Word-equation (OMML) value ("If , then the –value for  when  is .") — restored with LaTeX from the docx equations; prose unchanged | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 7/Test7_Math_Answer_Explanations.docx, table for Question 21 (MODULE 2B), m:oMath elements |
| R&W M1 | 26 | `cmsjrnwt7019dqmt14cfxvtbt` | other | stimulus starts "notes:" — the usual lead "While researching a topic, a student has taken the following" is missing, but it is also missing in the source (page screenshot cropped). Not restored (would be invented text). | needs_review | `Test 7 RW.pdf` p16 rendered: page begins with "notes:" |

## Checked and clean

- **Answer keys:** 98/98 match `TEST 7 ANS KEY.docx` (R&W1, R&W2B, MATH1, MATH2B columns).
- **Explanations:** no shift. Every R&W and Math explanation matches its own docx entry (similarity 1.00 vs 0.0-0.5 for neighbours),
  and each "Correct Answer: X" equals the stored key. R&W M1 #20 and Math M1 #16 differ from the docx because they were deliberately rewritten earlier
  (the docx text contains "wait —" self-corrections); left as is.
- **R&W M2 #15/#19/#24 (Chidon / astrology / orchids) and the M2 #20-24 cluster:** each stimulus now equals its own source passage word for word
  (pp27-32); no duplicate or bleed left. M2 #8 option D is clean.
- **All R&W options and stems** match the OCR word for word. M2 #1/#2 options (page 18 OCR has none) were checked on the rendered page.
- **Math M1 #17/#18 tables** are images (blood-type 2×5 table; x/f(x) table) that match the source; nothing flattened. Images for M1 #16/#19/#22,
  M2 #2/#17/#18/#20 and R&W M1 #11, M2 #12 are the right figures.
- Math options all match the rendered pages. No `w^*`/exponent OCR errors found.
- The single-`$` prices in Math M2 #10 render as prose (renderer currency rule); no change.
