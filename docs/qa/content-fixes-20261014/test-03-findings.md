# TEST 3 — neighbour bleed / options-in-stem / flattened tables (2026-10-14)

Read-only audit of the 98 published questions of Full Practice Test "TEST 3" (R&W M1/M2 27+27, Math M1/M2 22+22) against the current `dev.db`.
Detectors: shared 8-gram runs with N-1/N+1, option markers/lines in stem or stimulus, "table/chart" references with no pipe table and no image, UI text, and a comparison of every option and stimulus sentence against the source page OCR (`IngestPageArtifact.extractedText`). Every hit was confirmed on the rendered source page.
Sources: `files_to_load/MOCK EXAMS/TEST 3/READING AND WRITING/INNOV test 3 R&W mod. 1 and 2B.pdf` (p1-31) and `.../MATH/Test 3 REV Math modules 1&2(A and B).pdf` (p1-16).
Ops: `specs/test-03.json` (17 guarded ops; each `before` was read from the DB and checked again after writing).

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 14 | cmsjrnvhd00ubqmt1oy49iejm | bleed | The stimulus also contains the full passages of #15 (Waterfalls) and #16 (Catlett) | Trim the stimulus to "...findings of this study _____" | RW p7 image + OCR |
| R&W M1 | 17 | cmsjrnvhw00uxqmt1p3eubmrm | bleed | The stimulus also contains the passages of #18 (Sinek) and #19 (MC Jin) | Trim the stimulus to the Stonehenge passage | RW p8 |
| R&W M1 | 20 | cmsjrnvif00vrqmt1oy7f0n6o | bleed | The stimulus also contains the passages of #21 (Employers) and #22 (Onions) | Trim the stimulus to the Mongolia passage | RW p9 |
| R&W M2 | 20 | cmsjrnvii00vsqmt1jzc25dsp | bleed (residue) | The stimulus starts mid-sentence ("in an effort to..."). Its opening had bled into #19 option D and was dropped when #19 was fixed | Restore "Many organizations are turning to a policy called “job sharing” " | RW p26 OCR + image |
| R&W M2 | 24 | cmsjrnvj700w4qmt1rfg1dcx6 | bleed | The stimulus starts "For Several...". "For" bled from #23 option A | Remove the leading "For " | RW p28 |
| R&W M2 | 9 | cmsjrnvg700tjqmt1xgwffl5s | other | The two paired texts are merged without the "Text 1"/"Text 2" labels the stem uses | Add the labels and split into paragraphs | RW p18 |
| R&W M2 | 9 | (opts B, C) | other | Options B and C are truncated or paraphrased | Restore the full source text | RW p18 |
| R&W M1 | 6 | (opts B, C) | other | Option B is truncated; option C is missing "the" | Restore the source text | RW p3 |
| R&W M1 | 8 | (opts C, D) | other | Options C and D are truncated ("...in advance of the party." / "...that ... in the future.") | Restore the source text | RW p4 |
| R&W M2 | 15 | (opt B) | other | Option B is truncated (", since they are likely to change degrees...") | Restore the source text | RW p24 |
| Math M1 | 16 | cmsjrntwj00c2qmt1dlfrtelp (opts A-C) | other | Options A-C are abbreviated ("Will pass with more than 50%, but exact % ...") | Restore the full source text | Math p6 |
| Math M1 | 20 | cmsjrntx500caqmt1bpt36vtp | other | Degree sign appears as "*" (`sin(C*)`, `cos(63*)`) | Replace with "°" | Math p7 image |
| R&W M1 #24 / M2 #25 | — | cmsjrnvj400w3qmt1rwbyj43s / cmsjrnvjd00waqmt1kk678x3k | needs_review (source_error) | The same Frances Perkins question appears in both modules. The source PDF itself repeats it (p10 and p29) | No op. Product decision | RW p10, p29 |

Not in scope / no op:
- **Options in stem:** 0 remaining. The earlier "x A / × B" dumps (R&W M1 #2, #8, #9, #12, #21, #22) are already fixed in the DB.
- **Flattened tables:** 0. Math M1 #16 (table image), Math M2 #21 and #22, R&W M1 #11 and R&W M2 #12 all have their table or graph as `imageUrl`.
- The other items from `docs/qa/test-03-findings.md` (COME BACK LATER, number prefixes, R&W M2 #1/#19 option D, Math M1 #17, Math M2 #17) are already fixed in the DB.
- **Cosmetic:** R&W M1 #2 and #8 run the intro line straight into the passage with no paragraph break. The "notes" questions (R&W M1 #25-27, M2 #26-27) have their bullets inline ("- ... - ..."). R&W M1 #25 has no "While researching..." intro, but the source doesn't have one either.

Counts: bleed 5 ops (5 questions) · options_in_stem 0 · flattened_table 0 · other 12 ops (6 questions) · needs_review 1 (source duplicate). **Total: 17 ops.** No answer keys are touched.
