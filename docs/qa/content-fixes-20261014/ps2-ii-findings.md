# PS round 2: Reading / Information and Ideas (2026-10-14)

Scope: `filterSets(resolveReadingPracticeSets(db), {domain:"Information and Ideas"})`, which is 9 sets and 204 questions:
- Command of Evidence: EASY 36, MEDIUM 32, HARD 36
- Inferences: EASY 13, MEDIUM 13, HARD 26
- Main Ideas and Details: EASY 16, MEDIUM 15, HARD 17

All are MC with 4 options. dev.db was opened read-only.

Outputs:
- spec: `specs/ps2-ii.json` (30 guarded ops on 27 questions)
- checkpoint: `checkpoints/ps2-ii.jsonl` (204 lines: 27 fixed, 177 clean, 0 needs_review)

## Counts by class

| Class | Ops | Questions |
|---|---|---|
| explanation_glyph_displacement: apostrophes moved to the wrong place ("wouldn t … ’ music"), an em dash on its own line, or a doubled period ("MWh..") in the explanation | 21 (`Question.explanation`; HARD #27 also joins "wider- headed") | 21 |
| explanation_superscript: the superscript 2 of "cm²" dislocated ("because 2 this…(3.26 cm )"). The same op joins "second- smallest/largest" | 1 (`Question.explanation`) | 1 |
| glued_words: an italic title glued ("TheNew York", "BanjoLesson"), or a line-break hyphen left as "x- y" | 6 (1 stimulus, 5 options) | 6 |
| split_word: “vicuñas” stored as “vicu ñas” (stray space before ñ) | 1 (`Question.explanation`) | 1 |
| dollar_escape: a lone literal `$` in a table header, now `\$` | 1 (`Question.stimulus`) | 1 |
| **Total** | **30 ops** | **27** |

**Root cause of the 21 glyph-displacement ops.** All 21 questions, and CE MED #10, are among the explanations whose tails were appended by the 2026-09-24 truncation fix (`docs/qa/practice/reading-explanation-truncation.md`). That tail came from `pdftotext` default mode, which moves ’ and — in the text. The words are right, so the earlier fix is not redone. These ops only put the glyphs back where the ANS rationale has them (`pdftotext -raw`). After each op, the explanation equals the ANS rationale except for whitespace. The ops also drop the spaces around a few em dashes (" — " becomes "—", as in the source) and collapse double spaces.

Not found, 0 of each:
- neighbour bleed, or a passage appended or replaced
- a passage missing its first sentence
- options in the stem
- options shortened or paraphrased
- MC with fewer than 4 options
- flattened tables (all 25 table questions already have pipe tables whose cells match the source in order)
- stripped math or Unicode math-italic letters
- truncated, footer-leaked or shifted explanations
- UI/OCR artifacts
- notes or bullets (this domain has no notes questions)
- `correctAnswer` mismatches

## Fixes

| Set / # | id | Field | Class | Fix | Source |
|---|---|---|---|---|---|
| Command of Evidence - EASY #4 | `cmsjro19x02xjqmt1vj8tnuk2` | Question.explanation | explanation_glyph_displacement | doubled period in the explanation (1 spots) restored to the ANS rationale glyph positions | ANS p4 (a9040290) |
| Command of Evidence - EASY #9 | `cmsjro1af02y8qmt1cz0wfhfw` | Question.explanation | explanation_glyph_displacement | displaced em dash in the explanation (2 spots) restored to the ANS rationale glyph positions | ANS p10 (30c3aa98) |
| Command of Evidence - EASY #12 | `cmsjro1ap02ynqmt1m2v68i5x` | Question.explanation | explanation_glyph_displacement | doubled period in the explanation (1 spots) restored to the ANS rationale glyph positions | ANS p14 (a9ac31e4) |
| Command of Evidence - EASY #16 | `cmsjro1b302z7qmt1nd9d0vfo` | Question.explanation | explanation_glyph_displacement | doubled period in the explanation (1 spots) restored to the ANS rationale glyph positions | ANS p19 (e441da80) |
| Command of Evidence - EASY #24 | `cmsjro1c0030bqmt1vdkehstr` | Question.explanation | explanation_glyph_displacement | doubled period in the explanation (1 spots) restored to the ANS rationale glyph positions | ANS p29 (89f71526) |
| Command of Evidence - HARD #3 | `cmsjro1hd032pqmt1tlwf8gt4` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (16 spots) restored to the ANS rationale glyph positions | ANS p4 (068f939b) |
| Command of Evidence - HARD #17 | `cmsjro1je034mqmt16gcsrow7` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (7 spots) restored to the ANS rationale glyph positions | ANS p22 (df91532e) |
| Command of Evidence - HARD #27 | `cmsjro1kk035yqmt1odg5ll2d` | Question.explanation | explanation_glyph_displacement+glued_words | displaced apostrophes in the explanation (5 spots) restored to the ANS rationale glyph positions; line-wrap hyphen “wider- headed” joined | ANS p35 (31ad8024) |
| Command of Evidence - HARD #36 | `cmsjro1oh0377qmt1wjcrj5ip` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (8 spots) restored to the ANS rationale glyph positions | ANS p46 (124fdcd7) |
| Command of Evidence - MEDIUM #3 | `cmsjro29403h1qmt1vlngnyad` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (8 spots) restored to the ANS rationale glyph positions | ANS p4 (356ad646) |
| Command of Evidence - MEDIUM #6 | `cmsjro29j03hgqmt1pedgajtu` | Question.explanation | explanation_glyph_displacement | doubled period in the explanation (1 spots) restored to the ANS rationale glyph positions | ANS p8 (7edfb2c5) |
| Command of Evidence - MEDIUM #26 | `cmsjro2c603k8qmt1mlddbnnt` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (10 spots) restored to the ANS rationale glyph positions | ANS p35 (dd349efc) |
| Command of Evidence - MEDIUM #27 | `cmsjro2cb03kdqmt1q2ameh4p` | Question.explanation | explanation_glyph_displacement | doubled period + displaced apostrophes in the explanation (3 spots) restored to the ANS rationale glyph positions | ANS p37 (1db1a9a6) |
| Inferences - HARD #1 | `cmsjro30i03v7qmt1glvjrb30` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (5 spots) restored to the ANS rationale glyph positions | ANS p1 (f1bfbed3) |
| Inferences - HARD #2 | `cmsjro30l03vcqmt1t5yy8cei` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (8 spots) restored to the ANS rationale glyph positions | ANS p3 (6b8a7c74) |
| Inferences - HARD #4 | `cmsjro30s03vmqmt1cttk4ntm` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (2 spots) restored to the ANS rationale glyph positions | ANS p5 (4b3d6062) |
| Inferences - HARD #21 | `cmsjro37003xzqmt1wivusj8w` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (5 spots) restored to the ANS rationale glyph positions | ANS p22 (5c7e0d62) |
| Inferences - HARD #23 | `cmsjro37803y9qmt18ecvopnm` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (2 spots) restored to the ANS rationale glyph positions | ANS p24 (e503ae04) |
| Inferences - HARD #25 | `cmsjro37h03yjqmt1t65blora` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (9 spots) restored to the ANS rationale glyph positions | ANS p26 (65502c46) |
| Inferences - MEDIUM #13 | `cmsjro2xf03r1qmt17r70nnck` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (2 spots) restored to the ANS rationale glyph positions | ANS p13 (7afdcca2) |
| Main Ideas and Details - MEDIUM #7 | `cmsjro3xm04f7qmt10mwl1w2k` | Question.explanation | explanation_glyph_displacement | displaced apostrophes in the explanation (4 spots) restored to the ANS rationale glyph positions | ANS p7 (b38935ab) |
| Command of Evidence - MEDIUM #10 | `cmsjro2a203i0qmt1is3kvl3r` | Question.explanation | explanation_superscript+glued_words | the superscript 2 of “cm²” was dislocated (“because 2 this…(3.26 cm )”, “second- 2 smallest…(1.98 cm )”); restored as cm² (as in the table h | ANS p13 (f8244f7c) |
| Command of Evidence - EASY #26 | `cmsjro1c9030oqmt1tpoyv37r` | QuestionOption.text | glued_words | option C: italic title glued “TheNew York Times” | ANS p32 (145da981) |
| Command of Evidence - HARD #27 | `cmsjro1kl0362qmt17t166uq7` | QuestionOption.text | glued_words | option D: line-wrap hyphen left as “smooth- hound” | ANS p35 (31ad8024) |
| Command of Evidence - HARD #30 | `cmsjro1l1036gqmt1xi07427m` | QuestionOption.text | glued_words | option C: line-wrap hyphen left as “non- Indigenous” | ANS p39 (378c66d5) |
| Command of Evidence - MEDIUM #10 | `cmsjro2a303i3qmt1qc000qke` | QuestionOption.text | glued_words | option C: line-wrap hyphen left as “second- highest” | ANS p13 (f8244f7c) |
| Command of Evidence - MEDIUM #29 | `cmsjro2ck03krqmt1t994s4yo` | QuestionOption.text | glued_words | option D: line-wrap hyphen left as “in- person” | ANS p41 (98fd50f2) |
| Inferences - HARD #8 | `cmsjro31703w6qmt1cnj00k9h` | Question.explanation | split_word | “vicuñas” split as “vicu ñas” (2×), as in the ANS rationale “vicuñas” | ANS p9 (4ba0695d) |
| Inferences - HARD #16 | `cmsjro36e03xaqmt1g08w6alr` | Question.stimulus | glued_words | italic title glued “The BanjoLesson” (the same passage later spells “The Banjo Lesson”) | ANS p17 (0dccbf17) |
| Command of Evidence - EASY #26 | `cmsjro1c8030lqmt1vdvn1v96` | Question.stimulus | dollar_escape | lone literal “$” in the table header written as “\$” (literal-dollar convention; keeps every $ balanced) | ANS p32 (145da981) |

ANS PDFs are under `files_to_load/PRACTICE EXERCISES/EXERCISES READING/{COMMAND EVIDENCE,INFERENCES,MAIN IDEA AND DETAILS}/`. Each op carries its evidence path.

## needs_review

None.

## What was checked

**Method.** Every ANS and exercise PDF under `EXERCISES READING/` (529 IDs, no duplicates) was parsed with `pdftotext -raw` into blocks keyed by Question ID. Each question was matched by its `questionExternalId`, not by the resolver's filename. All 204 were found in both the ANS and the exercise PDF. The comparisons were:
- stimulus+stem against the "Question" block, with `**`, `++` and pipe-table markup ignored
- each option against its A–D line
- `explanation` against "Rationale"

Each was compared at word level, then character by character, treating all whitespace as equal. Every remaining character hunk was looked at by hand. The exercise-PDF question text also equals the ANS question text for 204/204.

**Results.**
- **Keys:** the ANS key equals `correctAnswer` for 204/204.
- **Explanations:** each one opens with "Choice <key> is the best answer" (Main Ideas EASY #13 says "Choice D is correct.", as its source does), so none is shifted. The words equal the ANS rationale for 204/204, except CE MED #10 (stray "2") and Inferences HARD #8 ("vicu ñas"), both fixed above. Nothing is truncated, no footer leaked, and no header was dumped.

**Already fixed, verified, no op.**
- **Command-of-Evidence chart crops:** all 23 questions whose PDF has a chart have `imageUrl` set, and the file exists in `public/uploads/questions/`. Their question text differs from the source only by the chart's axis and legend text.
- **77+4 truncated explanations:** all complete. Some of their appended tails had the glyph displacement fixed above.
- **15 reading-consistency explanations:** they match the source.

## Observations, no op

1. **Straight vs curly apostrophes:** CE MED #2 options A and C use `'` where the source has `’`. This is style only.
2. **Underlines `++…++` and bold table titles `**…**`** are intentional markup. The underlined parts match the source words.
3. **Stems and explanations keep the PDF hard line wraps.** This is systemic across practice sets and was left alone. So were the "x-⏎y" wraps inside explanations, which render as wraps.
4. **Legitimate "x- y" forms kept:** "the root mim- coming", "the mim- root" (CE HARD #3, a word root) and "plant- or animal-based" (CE MED #21, a suspended hyphen).
5. **Superscripts:** "¹⁵N/¹⁴N" (CE HARD #29) and "cm²" (CE MED #10 table) are written as Unicode superscripts, where the PDF has them as raised digits. They are correct.

Scratch scripts: `scratchpad/ps2/ii/`:
- `dump.mjs`, `parse.cjs`, `cmp.cjs`, `wd.cjs`, `pd.cjs`, `cdiff.cjs`, `scanc.cjs`: detection
- `build.cjs`: builds the spec
- `validate.cjs`: spec validation (before == DB, after != before, balanced `$`, KaTeX, no correctAnswer, no overlap with other specs: all pass)
- `ckpt.cjs`: writes the checkpoint
