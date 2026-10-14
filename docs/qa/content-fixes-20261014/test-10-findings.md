# TEST 10 — content audit (bleed / options-in-stem / flattened tables / explanation shift)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-10.json` (25 guarded ops: 19 on `Question`, 6 on `QuestionOption`; every `before` read from DB and asserted equal,
no `before===after`, one op per (table,id,field)). Tested on a scratch copy of dev.db with `apply-spec.cjs`: 25 PENDING → apply → 25 ALREADY, integrity ok.

Method: full dump of the 98 published questions + their ingest candidates; per-question verbatim search of stimulus/stem/options in the
source OCR (`IngestPageArtifact.extractedText`, R&W PDF 35 pp, Math PDF 19 pp) plus inspection of the text preceding every stimulus
(finds lost lead-ins and appended neighbours); all 19 Math pages and the relevant R&W pages rendered and read (Math options are images
in the OCR, so they were checked visually); all 14 question images opened; every explanation compared against
`Test10_RW_Answer_Explanations.docx` / `Test10_Math_Answer_Explanations.docx` (same Q vs Q±1 word overlap + "Correct Answer"/"Choice X" letter),
Word OMML equations extracted from the docx XML; every key compared with `TEST 10 ANS KEY.docx`.

## Counts

| Class | Ops |
|---|---|
| bleed | 1 |
| options_in_stem | 0 |
| flattened_table | 1 |
| explanation_shift | 0 |
| stripped_math | 3 |
| other | 20 (truncated passages ×2, truncated key option ×1, stray "The "/"➤" ×2, intro/passage paragraph break ×4, poem verse lines ×1, notes bullets ×2, underline marker ×1, duplicated graph image on option ×1, Math formatting ×6) |
| needs_review | 0 blocking (notes below, no op) |

- Answer keys: 98/98 match `TEST 10 ANS KEY.docx`; explanations: 98/98 about the right question and argue for the stored key (no shift).
- R&W M2 #20–#25 (old stimulus-swap chain): verified clean — every stimulus matches its own source page, option D of #20/#22/#24 no longer holds a passage.
- Math M1 #19: the image now shows both Data Set A and Data Set B (old "image incomplete" is resolved). Math M1 #7 stem and M1 #1 header OK.
- No "× A …" options-in-stem and no `[tbl-N.html]` placeholders left in TEST 10.

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 4 | `cmsjrnsxq0008qmt1wxyfhfiq` | other | stimulus truncated: opening sentence holding the ____ blank ("While all the benefits of sleep … works to ____ memories during a sleep cycle.") was lost; without it the question has no blank | fix (Question.stimulus) | IngestPageArtifact p2 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf (Q4 passage) |
| R&W M1 | 7 opt D | `opt opt_96ad4de311b44d55ac02b9a060d25b29` | bleed | option D ended with " The following text" = start of Q8's intro line | fix (QuestionOption.text) | IngestPageArtifact p4 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf: Q7 option D ends "…church organization and teaching."; "The following text comes from…" begins Q8 |
| R&W M1 | 8 | `cmsjrnsz50014qmt1na9sbtet` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p4 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf |
| R&W M1 | 13 opt D | `opt opt_ef7c463f6e084a0d807a053935a23dbf` | other | option D (the key) truncated mid-word ("…may not produce desired out"); restored full text | fix (QuestionOption.text) | IngestPageArtifact p9 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf: D "the growth mindset may not produce desired outcomes without additional factors like continual practice and hard work." |
| R&W M1 | 14 opt D | `opt opt_d43dbfa2e62a4b51b91b365d0e90370a` | other | stray "➤" (COME BACK LATER UI arrow) at end of option D | fix (QuestionOption.text) | IngestPageArtifact p10 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf: "☒ D advancements and for" then "➤ COME BACK LATER" |
| R&W M1 | 19 | `cmsjrnt1w002hqmt10ya7zghr` | other | stimulus truncated: opening sentence "One objective of the Supreme Court … state elections as well." dropped | fix (Question.stimulus) | IngestPageArtifact p12 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf (Q19 passage) |
| R&W M1 | 21 | `cmsjrnt2a002lqmt1ctzcykx6` | other | stray leading word "The " (passage begins "In 1834,") | fix (Question.stimulus) | IngestPageArtifact p13 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf (Q21 passage) |
| R&W M1 | 24 | `cmsjrnt2x002zqmt194kfilxx` | other | notes bullets flattened into one line; one bullet per line (text identical; source screenshot itself starts at "notes:") | fix (Question.stimulus) | IngestPageArtifact p15 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf + rendered page |
| R&W M1 | 25 | `cmsjrnt340035qmt16wj1iupc` | other | notes bullets flattened into one line; one bullet per line (text identical; screenshot has no intro line) | fix (Question.stimulus) | IngestPageArtifact p16 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf + rendered page |
| R&W M2 | 5 | `cmsjrnsyc000jqmt1zsjwuywp` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf |
| R&W M2 | 6 | `cmsjrnsyp000tqmt176iwhq7b` | other | underline marker started before the space ("and++ you"); move it to the underlined words | fix (Question.stimulus) | rendered p21 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf: underline spans "you will easily find … task of directing you" |
| R&W M2 | 7 | `cmsjrnsyz000zqmt1vzi20rcg` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p22 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf |
| R&W M2 | 8 | `cmsjrnsza0015qmt1bf7ttfky` | other | intro line and passage run together; restore paragraph break (text identical) | fix (Question.stimulus) | IngestPageArtifact p23 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf |
| R&W M2 | 10 | `cmsjrnt06001lqmt16edse07w` | other | poem lines and intro squashed into one paragraph; restore intro break and one verse per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p24 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf |
| R&W M2 | 12 opt D | `opt cmsojfkny000418pphjkv93qb` | other | option D carries the question's bar-graph image (same file as Question.imageUrl) → graph shown twice, once under D; source option D is text only | fix (QuestionOption.imageUrl) | rendered p25 of files_to_load/MOCK EXAMS/TEST 10/READING AND WRITING/INNOVATORS TEST 10 RW 1, 2B.pdf: option D is text only |
| Math M1 | 3 | `cmsnffuvs00050mmxg91q2rf1` | other | first equation of the system inline, second display; both are centred display equations in the source | fix (Question.stem) | rendered p1 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf |
| Math M1 | 21 | `cmsnffuzb00270mmxj89q3is6` | flattened_table | table (OCR [tbl-0.html]) had been paraphrased into the stem as prose ("— for x = -20, -17, -14, -11 the outputs … respectively"); rebuilt as pipe table + source sentence | fix (Question.stem) | rendered p8 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf: table x \| f(x): -20 25, -17 19, -14 13, -11 7; IngestPageArtifact p8 sentence |
| Math M2 | 17 | `cmsjrnu8400hiqmt1hq2iv0yf` | other | OCR inline math with stray spaces ("  \( 104^{\circ} \) ,"); normalise to $104^{\circ}$, | fix (Question.stem) | rendered p17 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf |
| Math M2 | 18 opt A | `opt cmsjrnu8800hoqmt1maranylh` | other | system of two inequalities on one line; source stacks them (one per line) | fix (QuestionOption.text) | rendered p17 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf: each option shows 3.50t + 5.25r ≤ 50 over the second inequality |
| Math M2 | 18 opt B | `opt cmsjrnu8800hpqmt1mnz4fvlg` | other | system of two inequalities on one line; source stacks them (one per line) | fix (QuestionOption.text) | rendered p17 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf: each option shows 3.50t + 5.25r ≤ 50 over the second inequality |
| Math M2 | 18 opt C | `opt cmsjrnu8800hqqmt16bcervtc` | other | system of two inequalities on one line; source stacks them (one per line) | fix (QuestionOption.text) | rendered p17 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf: each option shows 3.50t + 5.25r ≤ 50 over the second inequality |
| Math M2 | 18 opt D | `opt cmsjrnu8800hrqmt1zwljbf3e` | other | system of two inequalities on one line; source stacks them (one per line) | fix (QuestionOption.text) | rendered p17 of files_to_load/MOCK EXAMS/TEST 10/MATH/Test 10 Innov. Math.pdf: each option shows 3.50t + 5.25r ≤ 50 over the second inequality |
| Math M1 | 20 | `cmsnffuz700220mmxj997lph9` | stripped_math | Word equations stripped at import (e.g. "vertex of the graph is at , and" / "angle  measures ."); rebuilt the OMML as LaTeX, prose identical | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 10/Test10_Math_Answer_Explanations.docx Q20 (MODULE 1) OMML equations |
| Math M2 | 13 | `cmsjrnu7o00heqmt13yzsvmfz` | stripped_math | Word equations stripped at import (e.g. "vertex of the graph is at , and" / "angle  measures ."); rebuilt the OMML as LaTeX, prose identical | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 10/Test10_Math_Answer_Explanations.docx Q13 (MODULE 2B) OMML equations |
| Math M2 | 17 | `cmsjrnu8400hiqmt1hq2iv0yf` | stripped_math | Word equations stripped at import (e.g. "vertex of the graph is at , and" / "angle  measures ."); rebuilt the OMML as LaTeX, prose identical | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 10/Test10_Math_Answer_Explanations.docx Q17 (MODULE 2B) OMML equations |

## Notes (no op)

| Module | # | Question id | Note |
|---|---|---|---|
| R&W M2 | 9 | `cmsjrnszz001fqmt14wbig9k6` | Text 2 ends with "…seems too good to be true;" — the source screenshot itself is cut there (p23). DB = source; nothing to recover. |
| R&W M1 | 24 | `cmsjrnt2x002zqmt194kfilxx` | Intro is just "notes:" — the source screenshot is cropped above it (p15); the usual "While researching a topic, a student has taken the following notes:" is not in the source, so not added. |
| Math M2 | 20 | `cmsjrnu8j00htqmt1iahai9w7` | Explanation differs from the docx on purpose: the docx choice-C note contains a self-correcting ramble ("Wait — actually …"); the DB holds an earlier cleaned version. Kept. |
| Math M2 | 3, 4, 5, 6, 15 | — | Stems keep math as plain text ("5x - 8y = 40", "f(x)", "(200)(p)"); readable, not converted. |
