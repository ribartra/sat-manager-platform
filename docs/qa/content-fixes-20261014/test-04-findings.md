# TEST 4 — content audit (bleed / options-in-stem / flattened tables)

**Date:** 2026-10-14 · read-only on `dev.db` · 98 questions (R&W 27+27, Math 22+22).
Spec: `specs/test-04.json` (17 guarded ops on `Question`; every `before` re-read from DB and asserted equal).

Method: full dump of every published question + per-page parse of the source OCR (`IngestPageArtifact.extractedText`)
of the R&W PDF, compared passage/stem/options per question number; neighbour 8-gram overlap (N vs N±1);
regex for ×/✗/☒, "A)" sequences, UI chrome, `[tbl-…]`; manual read of all 98. Bleed and table cases confirmed
on rendered page images (R&W p35, Math p8, p14).

## Counts

| Class | Ops |
|---|---|
| bleed | 4 |
| options_in_stem | 0 |
| flattened_table | 2 |
| other (truncated lead-in x8, flattened bullets x2, escaped blank x1) | 11 |
| needs_review | 0 |

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| R&W M1 | 2 | `cmsjrnulq00jrqmt1389yvmk2` | other | stimulus truncated: lead-in "In 2014, the Lyndon B.…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p1 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q2 passage) |
| R&W M1 | 4 | `cmsjrnum200jvqmt109upui44` | other | stimulus truncated: lead-in "For years, the Great Chicago Fire of 1871 has been a widely …" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p2 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q4 passage) |
| R&W M1 | 16 | `cmsjrnuqf00l8qmt1f61d19vt` | other | stimulus truncated: lead-in "It is a common misconception that wildfire smoke smells like…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p12 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q16 passage) |
| R&W M1 | 20 | `cmsjrnuri00lgqmt1mxlaq4qz` | other | stimulus truncated: lead-in "Lady Duff Gordon, known professionally as Lucile, was one of…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p14 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q20 passage) |
| R&W M1 | 24 | `cmsjrnusl00loqmt1s8ktk357` | other | stimulus truncated: lead-in "Two generals fired by President Abraham Lincoln challenged h…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p16 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q24 passage) |
| R&W M2 | 2 | `cmsjrnult00jsqmt11bclwxwi` | other | stimulus truncated: lead-in "The novel *The Assistant* by Bernard Malamud explores the __…" dropped by parser (blank _____ was in the lost part; item unanswerable) | fix (Question.stimulus) | IngestPageArtifact p20 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q2 passage) |
| R&W M2 | 6 | `cmsjrnumk00k0qmt197fv9xq2` | other | stimulus truncated: lead-in "In contemporary cultural conversations in the United States,…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p22 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q6 passage) |
| R&W M2 | 8 | `cmsjrnumx00k8qmt1qcvbkuhl` | other | stimulus truncated: lead-in "This text is adapted from Edgar Allan Poe's 1820 poem "A Dre…" dropped by parser | fix (Question.stimulus) | IngestPageArtifact p23 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf (Q8 passage) |
| R&W M2 | 19 | `cmsjrnurb00lfqmt10dkeh6z4` | bleed | stimulus is neighbour #18 Stonehenge passage with "Such as" (from #17 option D) prefixed; options/answer belong to the source passage for Q19 | fix (Question.stimulus) | IngestPageArtifact p32 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf, Q19 block; page image p32 checked |
| R&W M2 | 21 | `cmsjrnurx00ljqmt14zfpdbq5` | bleed | stimulus is neighbour #20 Garbage Patch passage (tail); options/answer belong to the source passage for Q21 | fix (Question.stimulus) | IngestPageArtifact p33 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf, Q21 block; page image p33 checked |
| R&W M2 | 23 | `cmsjrnush00lnqmt1h59b2xff` | bleed | stimulus is neighbour #22 1840s fashion passage; options/answer belong to the source passage for Q23 | fix (Question.stimulus) | IngestPageArtifact p34 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf, Q23 block; page image p34 checked |
| R&W M2 | 25 | `cmsjrnusy00luqmt1cbphanc8` | bleed | stimulus is neighbour #23 Wilson Tower passage (chain shift); options/answer belong to the source passage for Q25 | fix (Question.stimulus) | IngestPageArtifact p35 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf, Q25 block; page image p35 checked (p35 rendered: plants/chlorophyll passage with Subsequently/Thus/Nevertheless/Besides) |
| R&W M1 | 26 | `cmsjrnut200lzqmt1vaqa2x9z` | other | notes bullets flattened into one line; restore list line breaks (text identical) | fix (Question.stimulus) | IngestPageArtifact p18 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf |
| R&W M1 | 27 | `cmsjrnuta00m9qmt1wtbg0yst` | other | notes bullets flattened into one line; restore list line breaks (text identical) | fix (Question.stimulus) | IngestPageArtifact p19 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf |
| R&W M2 | 24 | `cmsox4p4h0001d7ppk2bxq18m` | other | escaped blank \_\_\_\_\_ renders literally; use _____ | fix (Question.stimulus) | IngestPageArtifact p35 of INNOVATOR TEST 4 RW MOD 1 &2 REV.pdf shows "_____" |
| Math M2 | 2 | `cmsjrnv3r00q5qmt1jckooeke` | flattened_table | table values inlined as prose (no table, no image); rebuild 2-row table | fix (Question.stem) | INNOVATOR TEST 4 Math MOD 1&2.pdf p8 (rendered; OCR has [tbl-0.html] placeholder): a=3,6,9,12 / f(a)=-2,-1,0,1 |
| Math M2 | 16 | `cmsjrnv9l00rhqmt1x67ft34i` | flattened_table | "Vocabulary Test Scores" table inlined as prose (no table, no image); rebuild table | fix (Question.stem) | INNOVATOR TEST 4 Math MOD 1&2.pdf p14 (rendered; OCR has [tbl-0.html] placeholder): 100→1, 90→5, 80→10, 70→8, 60→2 |

## Notes

- **Bleed is a chain in R&W M2 #18–25**: #19, #21, #23 carry the passage of the previous question (#19 with "Such as" — the tail of #17 option D — glued on), and #25 carries #23's Wilson Tower passage. The real passages of #19 (Murakami), #21 (travel/painter) and #25 (plants/chlorophyll) were not published anywhere. Options and answer keys of all four match the source and are untouched; explanations of these four are empty.
- **Truncated lead-ins (8)**: the parser dropped the first sentence(s) of the passage. Most serious: R&W M2 #2, where the blank `_____` was in the lost sentence, so the item had no blank. The fix prepends the exact source sentence(s) and keeps existing markup (`++underline++` in M2 #6).
- **No options-in-stem** in the current DB: the 3 `stem_option_leak` cases in `docs/qa/test-04-findings.md` (R&W M1 #6, #11, M2 #8) are already clean; no "×"/☒ marks anywhere.
- **Flattened tables**: Math M2 #2 and #16 rebuilt as pipe tables from the rendered source (OCR only had `[tbl-0.html]`). Math M1 #12, M1 #16, R&W M1 #10, M2 #11, M2 #14 carry their table/graph as `imageUrl` — fine.
- Other neighbour-overlap hits are shared boilerplate ("Which choice completes the text…", "While researching a topic…") — not defects.
