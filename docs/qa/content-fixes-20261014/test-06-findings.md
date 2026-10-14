# TEST 6 — content audit (bleed / options-in-stem / flattened tables / explanation shift)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-06.json` (28 guarded ops: 26 on `Question`, 2 on `QuestionOption`; every `before` read from the DB and
asserted equal, no `before === after`, one op per table/id/field).

Method: full dump of every published question/options/explanation; per-question word diff against the page OCR
(`IngestPageArtifact.extractedText`) of `INNOVATOR TEST 6 RW.pdf` (36 pages) and `INNO TEST 6 MATH MOD 1, 2B.pdf`
(19 pages); every fixed R&W text re-checked to occur verbatim (normalised) in the source OCR; all 19 Math pages and
R&W p8/p13/p29/p34 rendered and read (Math options are images in the OCR). Explanations: every question's explanation
matched against its own `Question N` section of `Test6_RW_Answer_Explanations.docx` / `Test6_Math_Answer_Explanations.docx`
and read for meaning; keys compared with `TEST 6 ANS KEY.docx`.

## Counts

| Class | Ops |
|---|---|
| bleed | 7 (5 neighbour passages appended to a stimulus, 1 neighbour option D glued to a stimulus, 1 option holding the passage) |
| options_in_stem | 0 |
| flattened_table | 0 |
| explanation_shift | 0 |
| other | 21 (stem annotations x4, missing lead-in/intro x3, bullets x4, " -" stem tail x2, page header x1, truncated option x1, Text 1/2 labels x1, explanation OMML holes x2, hard-wrapped stems x2, degree OCR x1) |
| needs_review (no op) | 2 |

## Findings

| Module | # | Row id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 1 | `cmsjrnwau0124qmt1maz72mj9` | other | page header "MODULE 1 R&W" glued to the start of the passage | fix (Question.stimulus) | IngestPageArtifact p1 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (header line above the passage) |
| R&W M1 | 4 | `cmsjrnwbn012aqmt1z3x4mrbh` | other | passage intro line (source attribution) dropped; explanation refers to Cooper | fix (Question.stimulus) | IngestPageArtifact p2 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (Q4: intro line above passage) |
| R&W M1 | 6 | `cmsjrnwe1012eqmt111s0ocfy` | bleed | #5 option D text glued to the start of the passage | fix (Question.stimulus) | IngestPageArtifact p3 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: that sentence is Q5 option D; Q6 passage starts "The following text is from Horatio Alger's…" |
| R&W M1 | 11 | `cmsjrnwfo013fqmt1vzmkgsij` | other | stray " -" at the end of the stem | fix (Question.stem) | IngestPageArtifact p7 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf |
| R&W M1 | 12 | `cmsjrnwfz013oqmt1txlvo9a9` | other | option C truncated mid-sentence (the page OCR split it across a column break) | fix (QuestionOption.text) | IngestPageArtifact p8 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (second, complete "C" line) + rendered page image p8; explanation quotes the full option |
| R&W M1 | 14 | `cmsjrnwgg0145qmt1ut696w4u` | bleed | stimulus carried #15's full passage appended after the blank; cut it | fix (Question.stimulus) | IngestPageArtifact p10 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: Q14 and Q15 are separate passages on the same page; #15 already holds its own passage |
| R&W M1 | 16 | `cmsjrnwgt014lqmt17m35ggyt` | bleed | stimulus carried #17's full passage appended after the blank; cut it | fix (Question.stimulus) | IngestPageArtifact p11 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: Q16 and Q17 are separate passages on the same page; #17 already holds its own passage |
| R&W M1 | 18 | `cmsjrnwh60155qmt1u16p1fqt` | bleed | stimulus carried #19's full passage appended after the blank; cut it | fix (Question.stimulus) | IngestPageArtifact p12 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: Q18 and Q19 are separate passages on the same page; #19 already holds its own passage |
| R&W M1 | 20 | `cmsjro62j05nxqmt14ice94zf` | other | topic annotation in parentheses (from the explanations docx heading) appended to the stem | fix (Question.stem) | rendered page image p13 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (stem has no annotation); annotation text = Question 20 heading in Test6_RW_Answer_Explanations.docx |
| R&W M1 | 21 | `cmsjro63d05nyqmt1ywr1rvg1` | other | topic annotation in parentheses (from the explanations docx heading) appended to the stem | fix (Question.stem) | rendered page image p13 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (stem has no annotation); annotation text = Question 21 heading in Test6_RW_Answer_Explanations.docx |
| R&W M1 | 24 | `cmsjrnwi2015nqmt1j5ryyc6x` | bleed | stimulus carried #25's full passage appended after the blank; cut it | fix (Question.stimulus) | IngestPageArtifact p15 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: Q24 and Q25 are separate passages on the same page; #25 already holds its own passage |
| R&W M1 | 26 | `cmsjrnwid015rqmt1mqzo7guo` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p16 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (one bullet per line) |
| R&W M1 | 27 | `cmsjrnwij015xqmt1do3zv42b` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p17 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (one bullet per line) |
| R&W M2 | 6 | `cmsjrnwe7012fqmt1fxiy6t5e` | other | passage missing its opening words "The Australian “daddy longlegs”" | fix (Question.stimulus) | IngestPageArtifact p20 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (Q6 passage); explanation quotes the full first sentence |
| R&W M2 | 7 | `cmsjrnwel012lqmt1nl1zxrxv` | other | passage missing its opening words "A study led by Dr." | fix (Question.stimulus) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf |
| R&W M2 | 7 | `cmsjrnwel012lqmt1nl1zxrxv` | other | topic annotation in parentheses (from the explanations docx heading) appended to the stem | fix (Question.stem) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (stem has no annotation) |
| R&W M2 | 7 | `cmsjrnwen012mqmt1v9vq515p` | bleed | option A held a copy of the passage instead of the answer choice (A is the key) | fix (QuestionOption.text) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf option A; explanation "Correct Answer: A — To provide a summary…" |
| R&W M2 | 8 | `cmsjrnwf1012vqmt165a9nfs4` | other | "Text 1"/"Text 2" labels missing although the stem cites them | fix (Question.stimulus) | IngestPageArtifact p22 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf ("### Text 1" / "### Text 2" headings) |
| R&W M2 | 14 | `cmsjrnwgk014aqmt1lv54oj89` | other | stray " -" at the end of the stem | fix (Question.stem) | IngestPageArtifact p28 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf |
| R&W M2 | 16 | `cmsjrnwgw014qqmt11sl2gzpf` | other | topic annotation in parentheses (from the explanations docx heading) appended to the stem | fix (Question.stem) | IngestPageArtifact p30 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (stem has no annotation) |
| R&W M2 | 22 | `cmsjrnwht015kqmt1qqwaiggw` | bleed | stimulus carried #23's full passage appended after the blank; cut it | fix (Question.stimulus) | IngestPageArtifact p33 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf: Q22 and Q23 are separate passages on the same page; #23 already holds its own passage |
| R&W M2 | 26 | `cmsjrnwif015sqmt1osjyo64w` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p35 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (one bullet per line) |
| R&W M2 | 27 | `cmsjrnwim0162qmt18wl0n7uu` | other | notes bullets flattened into one line; restore one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p36 of files_to_load/MOCK EXAMS/TEST 6/READING AND WRITING/INNOVATOR TEST 6 RW.pdf (one bullet per line) |
| Math M1 | 14 | `cmsjrnvuv00y1qmt18u6xmqr1` | other | explanation had empty holes where the docx equations (OMML) were dropped; restored as LaTeX | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 6/Test6_Math_Answer_Explanations.docx Question 14 (OMML: y=a(x−h)^2+k, (h,k), Quadrant I/II/IV/III, −h, +k, f(x)=2[(x−60)^2+30]) |
| Math M1 | 18 | `cmsjrnvwf00ydqmt1f7d5ajep` | other | explanation had empty holes where the docx equations (OMML) were dropped; restored as LaTeX | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 6/Test6_Math_Answer_Explanations.docx Question 18 (OMML fractions / x^6 / x and y) |
| Math M2 | 11 | `cmsjrnvu200xwqmt111o4h2v6` | other | sentence hard-wrapped with OCR line breaks; join into one paragraph (text identical) | fix (Question.stem) | IngestPageArtifact p14 of files_to_load/MOCK EXAMS/TEST 6/MATH/INNO TEST 6 MATH MOD 1, 2B.pdf + rendered page image (column wrap only) |
| Math M2 | 12 | `cmsjrnvua00xyqmt14touuur7` | other | sentence hard-wrapped with OCR line breaks; join into one paragraph (text identical) | fix (Question.stem) | IngestPageArtifact p14 of files_to_load/MOCK EXAMS/TEST 6/MATH/INNO TEST 6 MATH MOD 1, 2B.pdf (column wrap only) |
| Math M2 | 22 | `cmsjrnvy000yuqmt1dmcha9vm` | other | OCR degree sign read as ^{*} (a*, b*, c*); use ^{\circ} | fix (Question.stem) | rendered page image p19 of files_to_load/MOCK EXAMS/TEST 6/MATH/INNO TEST 6 MATH MOD 1, 2B.pdf (a°, b°, c°) |
| Math M2 | 4 | `cmsjrnvpm00xaqmt1bew7npfe` | other | `Question.type = MC` with no options, but the source is a grid-in (answer box) and the key is `29` (numeric). As published it is unanswerable as multiple choice. | **needs_review** — change `type` to `NUMERIC` (field outside this spec's scope) | rendered page image p11 of the Math PDF (answer box, no choices); ANS KEY Math 2B #4 = 29 |
| R&W M2 | 15 | `cmsjrnwgq014gqmt1ybar7sk0` | other | option A reads "…allowing them to **change** higher rates…" — typo is in the source PDF itself; explanation quotes "charge". | **needs_review** (source-faithful; editorial call whether to correct to "charge") | rendered page image p29 of the R&W PDF |

## Notes

- **Bleed (current DB):** of the 13 systemic stimulus bleeds listed in `docs/qa/test-06-findings.md`, 8 are already clean;
  the 5 left (R&W M1 #14/#16/#18/#24, M2 #22) each carry the *whole* passage of the next question after their own
  blank. The fix cuts exactly the neighbour's current stimulus (asserted equal) — nothing else changes. M1 #6 started with
  #5's option D ("By admitting that ebooks…"). M2 #7 option A held a copy of the passage instead of the key
  "To provide a summary of the study's findings…" (A is the key; restored from page 21).
- **No options-in-stem, no flattened tables:** no ×/☒/✕ marks or "A)" sequences in any stem; tables (R&W M1 #9, #11,
  M2 #14; Math M1 #5, #21) and graphs/figures are published as `imageUrl` and exist on disk. Math M1 #8 lists values
  inline exactly as the source does.
- **Explanations:** no shift — every explanation argues for the stored key and talks about its own question
  (R&W and Math). R&W M2 #20 explanation argues C (key C, as previously fixed); the docx/key disagreement on M2 #18/#20
  was left untouched. Math M1 #14 and #18 explanations had blank holes where the docx's Word equations (OMML) were
  dropped at ingest; restored from the docx's OMML as LaTeX (NBSPs in those two explanations normalised to spaces).
- **Stem annotations** ("(Candide / Leonard Bernstein / …)") on R&W M1 #20/#21, M2 #7/#16 are the topic hints from the
  explanations-docx headings; M1 #20/#21 were ingested from the docx because page 13 of the PDF is an image.
- **Answer keys:** 97/98 match `TEST 6 ANS KEY.docx`; R&W M2 #18 is C in the DB (ANS KEY D, explanations docx C). M2 #20 is C (ANS KEY C; the explanations docx argues D, the DB explanation was already rewritten to argue C). Known history, not changed.
- Options compared word for word with the source: no shortened/paraphrased options apart from M1 #12 C (truncated).
