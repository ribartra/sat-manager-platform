# PS round 2: Standard English Conventions (Writing) findings

Area `sec`: `filterSets(resolveWritingPracticeSets(db), {domain:"Standard English Conventions"})`.
That is 9 sets and 141 questions: Boundaries EASY 16, MEDIUM #1 10, MEDIUM #2 11, HARD #1 14, HARD #2 16, HARD #3 15, and Form, Structure, and Sense EASY 17, MEDIUM 19, HARD 23.
dev.db was opened read-only. All 141 questions are in `checkpoints/ps2-sec.jsonl`.

## Counts by class

| class | questions | ops |
| --- | --- | --- |
| missing_space (space dropped at an italic-run boundary in the stem) | 4 | 4 |
| neighbour bleed / passage appended, replaced or missing its first sentence | 0 | 0 |
| options in stem / fewer than 4 options | 0 | 0 |
| options shortened or paraphrased (word for word, punctuation included) | 0 | 0 |
| blank `_____` missing or misplaced | 0 | 0 |
| explanation cut / leaked footer / header dump / shifted by one | 0 | 0 |
| flattened tables / stripped math | 0 | 0 |
| wrong key | 0 | 0 (keys are never changed) |

Totals: 137 clean, 4 fixed, 0 needs_review. Spec: `specs/ps2-sec.json` (4 ops).

## Fixes

| set / # | id | class | change | source |
| --- | --- | --- | --- | --- |
| Boundaries EASY #10 | cmsjro51u0519qmt1cj8cbiaj (7b950fc2) | missing_space | `foundedLas` → `founded Las` | Boundaries Easy.pdf p10 (page image checked) + ANS Boundaries Easy.pdf |
| Boundaries HARD #1 #6 | cmsjro5hd05b4qmt1noyaqkv0 (aaa1907f) | missing_space | `Magos,an` → `Magos, an` | BOUNDARIES H1.pdf + ANS BOUNDARIES H1.pdf |
| Form, Structure, and Sense HARD #10 | cmsjro5ya05k1qmt1rhynt815 (3bceeb93) | missing_space | `Ornithorhynchusparadoxus:` → `Ornithorhynchus paradoxus:`; `animal,which` → `animal, which` | GRAMMAR HARD .pdf + ANS GRAMMAR HARD.pdf |
| Form, Structure, and Sense MEDIUM #9 | cmsjro6i705ybqmt1wiow2v83 (8d53e7a0) | missing_space | `X,winner` → `X, winner` | GRAMMAR MED .pdf + ANS GRAMMAR MED .pdf |

The ingest extraction dropped the space wherever an italic run (a title or a species name) starts or ends. After the fix, each `after` matches the exercise PDF text exactly, apart from whitespace.

Spec validation passed: every `before` equals the DB value, every `after` differs from its `before`, `$` is balanced (none present), KaTeX renders, there is one op per (table, id, field), and no op touches `correctAnswer`.

## needs_review

None.

## Method and what was found clean

- **Sources.** Every exercise PDF and ANS PDF was extracted with `pdftotext -raw`.
  - Default and `-layout` modes reorder curly quotes, apostrophes, em dashes and accented glyphs in these PDFs. That produces false diffs in options, for example `of—` showing up as `of`.
  - Questions were joined to the ANS by Question ID hex across all 9 ANS files. The regex handles the H2/H3 `Question ID <hex>` form without the colon.
  - The resolver's `ansPdf` is wrong for some sets: all three HARD sets point at `ANS BOUNDARIES H 2.pdf`, and MEDIUM #2 points at `Ans Boundaries Med 1.pdf`. The hex join does not depend on it.
  - Fixed 2026-10-14: `findAnsPdf` now pairs by set number (H1/H 2/H 3, Med 1/2) before the difficulty token, on a sorted listing. All 6 Boundaries sets resolve to their own ANS; the other 85 practice sets are unchanged. Re-check: 788/788 Writing+Reading question IDs are found in their resolved ANS, and 82/82 Boundaries keys and explanations match it, so no data was affected.
- **Answer keys.** 141/141 match the ANS. Every explanation opens with "Choice <key> is the best answer", so none is shifted against the key.
- **Stems.** All 141 match both the ANS and the exercise PDF word for word, apart from whitespace and the 4 fixes above.
  - No neighbour text, no appended or replaced passage, no missing first sentence.
  - Exactly one `______` per stem, in the source position.
  - `stimulus` is NULL by design.
- **Options.** 4 per question, and all 564 match both PDFs character for character, with commas, semicolons, colons and dashes included.
- **Explanations.** All 141 equal the ANS rationale apart from whitespace.
  - In the ANS PDFs, page-break headers (Assessment/Test/Domain/Skill/Difficulty) and the trailing `Question Difficulty:` footer were stripped before comparing.
  - None of these artifacts is present in the DB.
- **The 15 Boundaries HARD explanations from `specs/ps-trunc.json`** are already applied and are complete against the ANS. That includes the 4 whose rationale crosses a page break (6e071432, c06af4d8, a05cc490, 21e58a83).
- **Style-only, no op:**
  - Boundaries EASY #14 (603755a5) and MEDIUM #2 #2 (403d7bb5): the explanations use straight quotes or `...` where the ANS prints curly quotes or `…`. The wording is otherwise identical.
  - Words hyphenated at a line break (e.g. `short-\nterm`) keep the PDF line layout. The text is rendered with `whitespace-pre-wrap`.
- **Pattern scans: 0 hits.** These covered `Question ID`, `ID:`, `Assessment`, form feeds, page numbers, `A.`/`A)` lines, `×`, `[tbl`, `#` and `$`.
  - The one option-in-stem flag (MEDIUM #1 #7, "Swentzell") is a false positive. The name is part of the passage.

Scratch scripts are in `scratchpad/ps2/sec/`: parse.py, cmp.py, diff.py, extra.py, build.py and validate.cjs.
