# TEST 2: findings for bleed, options in stem and flattened tables (2026-10-14)

Read-only audit of the 98 published questions (R&W M1/M2 27+27, Math M1/M2 22+22) in `dev.db`.
The ops are in `specs/test-02.json`: 72 guarded ops. Every `before` was re-read from the DB and checked byte-for-byte.
Sources used:
- `files_to_load/MOCK EXAMS/TEST 2/READING AND WRITING/INNOVATOR TEST 2 R&W MOD 1 REV.pdf`, which holds both R&W modules (OCR from `IngestPageArtifact`, plus rendered pages 6, 13 and 34).
- `.../MATH/Innov. Test 2 Math Mod 1, 2B REV.pdf` (OCR plus rendered pages 1, 5, 7, 9, 11, 13 and 14).
- `Test2 RW Answer Explanations.docx`.

## Counts per class

| class | questions | ops |
|---|---|---|
| bleed (neighbour text inside stimulus or option) | 4 (R&W M1 #8, #10, #18; M2 #25) | 5 |
| bleed (explanation belongs to the next question) | 34 (R&W M1 #20–#27, M2 #1–#26) | 34 |
| options_in_stem | 1 (Math M1 #19) | 1 |
| flattened_table | 0 | 0 |
| other | 17 | 32 |
| **total** | | **72** |

No flattened tables: all four table/chart questions (Math M1 #22, M2 #5, M2 #6, plus the dot plots M1 #12 / M2 #18) have an `imageUrl` with the actual table or figure. No "×" cross-out characters remain in any stem, stimulus or option. All answer keys are unchanged.

## Findings

| module | # | question id | class | what | fix | evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 8 | cmsjrntym00dhqmt1nan99z1j | bleed | stimulus starts with "Harcourt's worries are making her antisocial." (#7 choice D) | strip prefix | p4 OCR |
| R&W M1 | 10 | cmsjrntz800dpqmt1kbv7yjkl | bleed | stimulus cut at "(pre power"; option D carries the rest of the passage ("plant usage) and samples 3–8 … improve.") | move tail from opt D to stimulus | p6 OCR + page image |
| R&W M1 | 18 | cmsjrnu1400fhqmt1pudev181 | bleed | stimulus starts with "Pointing " (end of #17 choice D) | strip prefix | p11 OCR |
| R&W M2 | 25 | cmsjrnu4m00g8qmt1ln8xwuho | bleed | stimulus starts with "Moreover, " (#24 choice D) | strip prefix | p34 OCR + image |
| R&W M1 #20 → M2 #26 | 34 Qs | (see spec) | bleed | **explanations shifted by one**: each question shows the explanation of the next one (M2 #26 duplicates #27). Root cause: in the docx, Module 1 Q20 is written as paragraphs, not a table, so the table-to-question mapping slipped from Q20 on. Students see explanations that argue for a different letter than the key. | each Q gets the explanation currently on Q-1 (identical to its docx table); M1 #20 rebuilt from the docx paragraphs | docx per-question match (19/19 aligned before #20, 34 shifted, M2 #27 OK); post-fix "Choice X is the best answer" = key for 54/54 |
| R&W M1 | 22, 23 | cmsjrnu3x00ftqmt1ibkva47j, cmsjrnu4400fvqmt1urag3ikr | other | stimulus missing its first sentence ("Inflated gas prices…", "Viewing objects through the atmosphere… stained glass window.") | prepend | p13 OCR |
| R&W M2 | 2 | cmsjrntxj00ciqmt1l8bids96 | other | missing intro "The following text is from Nikolai Gogol's 1836 play *The Government Inspector*." | prepend | p18 OCR |
| R&W M2 | 4 | cmsjrntxv00cuqmt1sup0n1ka | other | missing first sentence ("One obstacle to developing…") | prepend | p19 OCR |
| R&W M2 | 8 | cmsjrntyq00diqmt1mcdtavjn | other | Text 1 / Text 2 labels missing, but the stem refers to them | add labels | p23 OCR |
| R&W M2 | 18, 20, 22, 24 | cmsjrnu1800fmqmt17wfap4ek, cmsjrnu3e00fqqmt1h7f87jtv, cmsjrnu4000fuqmt15u6d0tq6, cmsjrnu4f00g2qmt16j8izlxd | other | first sentence missing (Piggly Wiggly 1916; Monaco size; Abbott & Costello intro; "Dandelions are usually considered to be useless weeds.") | prepend | p31–34 OCR |
| Math M1 | 19 | cmsjrntgb006lqmt1k63h2kpd | options_in_stem | stem = "19" + question + the 4 full answer choices ("A The balloon is released…"); options A–C were abbreviated | stem = question only; options restored to source wording | p9 OCR + image |
| Math M1 | 12 | cmsjrntee005jqmt1vi9rhybu | other | stem starts with "12\n\n"; options abbreviated ("SD of Set 1 > …") | strip number; restore 4 options | p5 image |
| Math M1 | 16 | cmsjrntfh0063qmt1of57u7xi | other | `0.88^{1/3}` should be `^{t/3}`; options A–C abbreviated | fix exponent; restore A–C | p7 image @300dpi |
| Math M2 | 2 | cmsjrnt4c0048qmt1eokpmvyk | other | `4x^3 - 3` should be `4x^2 - 3` | fix | p11 image |
| Math M2 | 7 | cmsjrntct004uqmt1gxhecler | other | "(3) $\frac{t}{14}$" lost the exponent; options A, C, D abbreviated | `$(3)^{\frac{t}{14}}$`; restore | p13 image |
| Math M2 | 10 | cmsjrntdv0058qmt1psaqqhpu | other | `(8x - 20)^+` should be a degree sign | `^\circ` | p14 image |
| Math M2 | 18 | cmsjrntg7006kqmt10mtirx79 | other | options abbreviated ("Mean of J < mean of K; SDs equal.") | restore 4 options | p18 OCR |

## Noted, no op

- R&W M1 #3 "Ricard Harding Davis" (should be "Richard") and Math M1 #2 "y > 2x?": both appear this way in the source, so they were left alone.
- Math M1 #16 option D differs from the source by one word ("the equipment" vs "equipment") and was left alone. M2 #7 option B differs only by a trailing period and was left alone.
- Other Math options whose source shows them only as images were not compared word by word. Option paraphrasing looks like a candidate-level (LLM) artifact, so other tests may have it too.
- needs_review: none.
