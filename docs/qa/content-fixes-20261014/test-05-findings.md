# TEST 5 — content audit (bleed / options-in-stem / flattened tables / explanation shift)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-05.json` (27 guarded ops: 22 on `Question`, 5 on `QuestionOption`; every `before` read from the DB
and asserted equal; dry-run on a backup copy → 27 PENDING, apply on the copy → integrity ok, re-run → 27 ALREADY).

Method: full dump of the 98 published questions + source candidate/page (`IngestPageArtifact.extractedText`); per-question parse of the
R&W OCR (passage before "N.", stem, A–D options) compared word-for-word with stimulus/stem/options; Math compared against all 18 rendered
pages (70 dpi, zoomed to 150 dpi where needed); explanations compared per question with both Answer Explanations docx (word overlap with
N-1/N/N+1 + "Correct Answer: X" vs key); answer key docx vs `correctAnswer` (98/98 match); regex scan for ×/☒/✕, PREV/NEXT, `[tbl-…]`,
escaped blanks, "Wait/re-examine" leftovers. Underlines/intros confirmed on rendered R&W pages 2, 3, 4, 11, 22, 33.

## Counts

| Class | Ops |
|---|---|
| bleed | 1 |
| options_in_stem | 0 |
| flattened_table | 4 |
| explanation_shift | 0 |
| other | 22 |
| **total ops** | **27** |
| needs_review (no op) | 2 |

"other" (22) = truncated opening sentence/intro ×7 (R&W M1 #2/#4/#16/#18, M2 #4/#6/#25; M1 #16 had lost its blank), notes bullets
flattened ×4 (M1 #24/#25/#27, M2 #26), "N. A student wants…" lead leaked to the end of the stimulus + bullets ×2 (M1 #26, M2 #27) with
2 stem ops restoring that lead, Text 1/Text 2 labels ×2, underline span ×1, chart title glued to the passage ×1, PDF line breaks in a
stem ×1, shortened option ×1, missing explanation ×1.

No explanation shift in TEST 5: every R&W and Math explanation matches the docx entry with the same number (overlap 1.00, except the
deliberately cleaned ones R&W M2 #7/#20, Math M1 #22, M2 #14/#15/#16/#22) and argues for the stored key. No options-in-stem (no ×/☒
residue anywhere). No neighbour passage replacing a stimulus; the only bleed is R&W M1 #13 (carries #14's Richard III passage).

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 2 | `cmsjrnuty00mkqmt1rl2lbkh5` | other | stimulus truncated: opening sentence "The Mars Science Laboratory's Curiosity rover landed…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p1 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q2 block) |
| R&W M1 | 4 | `cmsjrnuug00moqmt19gv4u1s2` | other | source intro line ("The following text is from … *A Little Princess*.") dropped by parser | fix (Question.stimulus) | IngestPageArtifact p2 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q4 block); page image p2 checked |
| R&W M1 | 6 | `cmsjrnuuy00mwqmt156obl2h2` | other | underline span too wide: source underlines only "he lived like an honest man, … charitable to the poor." | fix (Question.stimulus) | IngestPageArtifact p4 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q6 block); page image p4 checked (underline starts at "he lived like") |
| R&W M1 | 7 | `cmsjrnuv800n2qmt1xezqm9ve` | other | "Text 1"/"Text 2" labels missing although the stem cites them; restored as separate paragraphs | fix (Question.stimulus) | IngestPageArtifact p5 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q7 block); source shows bold Text 1 / Text 2 headings |
| R&W M1 | 12 | `cmsjrnv0300o8qmt1poncffke` | other | graph title "Cost to deliver 1 MBtu" (not in the image) glued onto the passage's first sentence; put on its own line | fix (Question.stimulus) | IngestPageArtifact p9 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q12 block); graph title sits above the chart, image /uploads/questions/575c6f17… has no title |
| R&W M1 | 13 | `cmsjrnv0d00oeqmt1kaggzver` | bleed | stimulus carries #14's Richard III passage after its own Austen/Brontë passage; drop it (it is #14's stimulus verbatim) | fix (Question.stimulus) | IngestPageArtifact p10 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q13 block); p10 holds two passages: Austen/Brontë → Q13 options, Richard III → Q14 options; docx explanations Q13/Q14 confirm |
| R&W M1 | 16 | `cmsjrnv1c00owqmt1qqdqdbp6` | other | stimulus truncated: first sentence with the blank ("_____ the Red-headed woodpecker is…") dropped, item unanswerable | fix (Question.stimulus) | IngestPageArtifact p11 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q16 block); page image p11 checked |
| R&W M1 | 18 | `cmsjrnv1s00p4qmt18fsi1i6a` | other | stimulus truncated: opening sentence "The circadian rhythm is…" dropped (antecedent of "its"/"it") | fix (Question.stimulus) | IngestPageArtifact p12 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q18 block) |
| R&W M1 | 24 | `cmsjrnv2s00pqqmt1rew7cu53` | other | notes bullets flattened into one line; one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p16 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q24 block) |
| R&W M1 | 25 | `cmsjrnv2w00prqmt1kx284u6i` | other | notes bullets flattened into one line; one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p17 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q25 block) |
| R&W M1 | 27 | `cmsjrnv3400pxqmt139tcv9hk` | other | notes bullets flattened into one line; one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p19 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q27 block) |
| R&W M1 | 26 | `cmsjrnv3000psqmt1trpw9nor` | other | question lead "26. A student wants…" leaked to the end of the stimulus + notes bullets flattened; remove lead, one bullet per line | fix (Question.stimulus) | IngestPageArtifact p18 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q26 block) |
| R&W M1 | 26 | `cmsjrnv3000psqmt1trpw9nor` | other | stem missing its first sentence (it was left in the stimulus as "26. A student wants…") | fix (Question.stem) | IngestPageArtifact p18 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q26 block) |
| R&W M2 | 4 | `cmsjrnuuj00mpqmt1aqqs9ps0` | other | stimulus truncated: opening sentence "Lady Katherine Grey was a Tudor noblewoman…" dropped | fix (Question.stimulus) | IngestPageArtifact p21 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q4 block) |
| R&W M2 | 6 | `cmsjrnuv300mxqmt1zg5ieis9` | other | intro truncated: "The following text is from Charles Dickens's 1861 novel *Great Expectations*." dropped (only "Pip meets…" kept) | fix (Question.stimulus) | IngestPageArtifact p22 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q6 block); page image p22 checked |
| R&W M2 | 6 | `cmsjrnuv300mxqmt1zg5ieis9` | other | stem has hard line breaks from the PDF layout; join into one line | fix (Question.stem) | IngestPageArtifact p22 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q6 block) |
| R&W M2 | 8 | `cmsjrnuvq00ndqmt1hj2clfxy` | other | "Text 1"/"Text 2" labels inline with the passages; put each label/passage on its own paragraph | fix (Question.stimulus) | IngestPageArtifact p24 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q8 block) |
| R&W M2 | 25 | `cmsjrnwa3011qqmt1wsejspei` | other | stimulus truncated: opening sentence "Ammonite shells consist mostly of calcium carbonate…" dropped (antecedent of "these isotopes") | fix (Question.stimulus) | IngestPageArtifact p36 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q25 block) |
| R&W M2 | 26 | `cmsjrnwa7011rqmt16u4ur7c8` | other | notes bullets flattened into one line; one bullet per line (text identical) | fix (Question.stimulus) | IngestPageArtifact p37 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q26 block) |
| R&W M2 | 27 | `cmsjrnwac011wqmt14eysu7el` | other | question lead "27. A student wants…" leaked to the end of the stimulus + notes bullets flattened; remove lead, one bullet per line | fix (Question.stimulus) | IngestPageArtifact p38 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q27 block) |
| R&W M2 | 27 | `cmsjrnwac011wqmt14eysu7el` | other | stem missing its first sentence (it was left in the stimulus as "27. A student wants…") | fix (Question.stem) | IngestPageArtifact p38 of files_to_load/MOCK EXAMS/TEST 5/READING AND WRITING/INNOVATOR TEST 5 RW MOD 1&2.pdf (Q27 block) |
| Math M1 | 3 | `cmsjrnudd00i1qmt1bete05le` | flattened_table | option A text is the OCR placeholder "[tbl-0.html](tbl-0.html)" (table lost; full-test player does not render option images); rebuild Distance/Frequency table | fix (QuestionOption.text `cmsjrnude00i2qmt1ilisoxp2`) | files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf p2 rendered at 150 dpi (option A table); NOTE option image /uploads/questions/26f7ec2d02e8bc217d3abc5a.jpg wrongly shows B's table (3/2,5/4,7/1,10/2) — needs_review |
| Math M1 | 3 | `cmsjrnudd00i1qmt1bete05le` | flattened_table | option B text is the OCR placeholder "[tbl-1.html](tbl-1.html)" (table lost; full-test player does not render option images); rebuild Distance/Frequency table | fix (QuestionOption.text `cmsjrnude00i3qmt1snhzbrti`) | files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf p2 rendered at 150 dpi (option B table); matches option image /uploads/questions/6df0fd07ce13681566a826c8.jpg |
| Math M1 | 3 | `cmsjrnudd00i1qmt1bete05le` | flattened_table | option C text is the OCR placeholder "[tbl-2.html](tbl-2.html)" (table lost; full-test player does not render option images); rebuild Distance/Frequency table | fix (QuestionOption.text `cmsjrnude00i4qmt1d0kxmhje`) | files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf p2 rendered at 150 dpi (option C table); matches option image /uploads/questions/6cc3d066bb2f5d5dfa0cb668.jpg |
| Math M1 | 3 | `cmsjrnudd00i1qmt1bete05le` | flattened_table | option D text is the OCR placeholder "[tbl-3.html](tbl-3.html)" (table lost; full-test player does not render option images); rebuild Distance/Frequency table | fix (QuestionOption.text `cmsjrnude00i5qmt1uetr9pby`) | files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf p2 rendered at 150 dpi (option D table); matches option image /uploads/questions/a45b4aec6ff703d061d2ca10.jpg |
| Math M1 | 21 | `cmsjrnul000jhqmt1q1p9ey2x` | other | option A shortened: "in the year" dropped vs source | fix (QuestionOption.text `opt_e03fb23b16164f86915e37c9b812faaa`) | files_to_load/MOCK EXAMS/TEST 5/MATHS/INNOV. TEST 5 MATH  MOD 1&2.pdf p9 rendered at 150 dpi: "It takes a days in the year for the population to reach 80." |
| Math M2 | 4 | `cmsjrnudx00icqmt1p1cmv3f2` | other | explanation missing (NULL); restore from the Answer Explanations docx (OMML numbers 1995/6%/1994/10 re-inserted) | fix (Question.explanation) | files_to_load/MOCK EXAMS/TEST 5/Test5_Math_Answer_Explanations.docx, MODULE 2B Question 4 (text + m:t math runs) |

## needs_review (no op)

| Module | # | Question id | Class | What | Suggested action | Evidence |
|---|---|---|---|---|---|---|
| Math M1 | 3 | `cmsjrnudd00i1qmt1bete05le` | other | Option A `imageUrl` (`/uploads/questions/26f7ec2d02e8bc217d3abc5a.jpg`) shows option B's table (3/2, 5/4, 7/1, 10/2, the correct answer), so any view that renders option images shows two "correct" tables. Real A table: 3/2, 5/6, 7/7, 10/9. The text ops above rebuild all four tables; the image field is outside this spec's scope. | Set option A `imageUrl` to NULL (text now carries the table) or re-crop A from p2 | Math PDF p2 rendered at 150 dpi; option image files viewed |
| Math M1 | 22 | `cmsjrnulb00jjqmt1ij3wojjk` | other | Explanation keeps key B (60°) but its derivation is wrong/placeholder: it assumes base angles of 50° and ends "(Derivation abbreviated; verify against the figure.)". The docx explanation is itself a broken trial-and-error. Derivation that fits the figure: ∠BAC = 180−100 = 80°; AC = BC so ∠ABC = 80°, ∠ACB = 20°; vertical ∠FCD = 20°; CF = CD ⇒ ∠CFD = ∠CDF = 80°; G–F–E collinear and ∠GFC = 40° ⇒ ∠CFE = 140° ⇒ ∠DFE = 60°; FE = DE ⇒ ∠FDE = 60° ⇒ ∠E = 60°. | Rewrite the explanation (authoring decision; the source has no clean text) | Math PDF p9 figure; Test5_Math_Answer_Explanations.docx M1 Q22 |

Key check: `ANSWERS KEY TEST 5.docx` = DB on 98/98. Option wording: all 54×4 R&W options match the OCR word-for-word; Math options
match the rendered pages except M1 #21 A (fixed). Not changed: Math M1 #5 shows each system as "$…$ and $…$" (the source stacks the two
equations; same meaning). Issues in the old `docs/qa/test-05-findings.md` (option bleed R&W M1 #9/#17, UI screenshots, × leaks,
"A student wants" in R&W M2 #12) are already fixed in the current DB, except the M1 #3 option-A image listed above.
