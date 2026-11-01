# PS round 2: Reading / Craft and Structure (2026-10-14)

Scope: `filterSets(resolveReadingPracticeSets(db), {domain:"Craft and Structure"})`, which is 9 sets and 325 questions:
- Cross-Text Connections: EASY 15, MEDIUM 9, HARD 12
- Text Structure and Purpose: EASY 17, MEDIUM 17, HARD 14
- Words in Context: EASY 131, MEDIUM 56, HARD 54

All are MC with 4 options. dev.db was opened read-only.

Outputs:
- spec: `specs/ps2-cs.json` (57 guarded ops on 55 questions; validated: every `before` equals dev.db, `after !== before`, `$` balanced, KaTeX OK, no `correctAnswer` op)
- checkpoint: `checkpoints/ps2-cs.jsonl` (325 lines: 55 fixed, 270 clean, 0 needs_review)

## Method

- Every exercise and ANS PDF was extracted with PyMuPDF (word level, reading order). Underlines were detected from the vector strokes drawn under the words. Apostrophes and dashes were checked against `pdftotext -raw`.
- Each source block is keyed by its "Question ID" hex. All 325 hexes were found in the resolved exercise and ANS files, so no resolver mismatch.
- Per question, the following were compared with the source: stimulus+stem, each option, the key, and the explanation vs the ANS rationale. The comparison was done at three levels: alphanumeric only, token level (glued or split words), and character level without whitespace (punctuation and glyphs).

## Counts by class

| Class | Ops | Questions |
|---|---|---|
| lost_underline: the source underlines the word/phrase the question asks about, but the DB stimulus has no `++…++` (37). Or the span is wrong: Cross-Text EASY #11 left "The" outside it (1) | 38 (`Question.stimulus`) | 38 |
| glued_words+lost_underline: WIC MEDIUM #17 "considerthem", with the underline on "consider" lost | 1 (`Question.stimulus`) | 1 |
| explanation_glyph_displacement: apostrophes moved ("doesn t … ’ make", "the ‘ ’ views"), doubled periods ("is.."), spaces around em/en dashes (" — ", "1321 – 1407"), and spaces inside curly quotes ("“ 1321", "attention, ”"). All are in tails appended by the 2026-09-24 truncation fix (pdftotext default mode). The words were already correct; only the glyphs were put back where the ANS rationale has them | 14 (`Question.explanation`) | 14 |
| glued_words: "smallphotos" (stem, WIC EASY #66); "thesubak"/"subaksystem" (expl, WIC EASY #91); "provingrequirementsto" (expl, WIC MEDIUM #38). These are italic word boundaries or line wraps | 3 | 3 |
| dollar_escape: a lone literal "$30 billion" in a stem is now `\$30` | 1 (`Question.stem`) | 1 |
| **Total** | **57 ops** | **55** (WIC EASY #40 and WIC MEDIUM #38 each get an underline op and an explanation op) |

After each explanation op, the explanation equals the ANS rationale except for whitespace.

Not found, 0 of each:
- neighbour bleed, or a passage appended or replaced
- a passage missing its first sentence or its intro
- Cross-Text pairs with Text 1 or Text 2 missing or swapped
- options in the stem
- options shortened or paraphrased (all 1300 options match word for word)
- MC with fewer than 4 options
- flattened tables
- stripped math or Unicode math-italic letters
- truncated, footer-leaked, header-dumped or shifted explanations (all 325 match the ANS rationale for their own Question ID, and all start "Choice <key> is the best answer")
- UI/OCR artifacts, `[tbl-…]`, "Question ID" markers
- `correctAnswer` mismatches (325/325 match the ANS key)

Already-fixed items, verified only: the earlier truncated-explanation and reading-consistency fixes are complete. Their words match the ANS rationale; only the glyph placement above was left over.

Left alone on purpose (same as ps2-ii): the PDF hard line wraps in stems, stimuli and explanations, including "x-⏎y" wraps. They are systemic across practice sets and render as wraps. Also left alone: extractor-only splits in the source ("suppor ted", "F abry", "Cecil y"), which the DB has correctly joined.

## Fixes

| Set / # | id | Field | Class | Source |
|---|---|---|---|---|
| Cross-Text Connections EASY #11 | `cmsjro20y03cwqmt1cp3ty3w6` | Question.stimulus | lost_underline | DOUBLE PASSAGE/DOUBLE PASSAGE EASY.pdf p11 (Question ID 22105871) |
| Cross-Text Connections HARD #2 | `cmsjro21j03dqqmt1j5gbbrj3` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASSAGE HARD.pdf p2 (Question ID 105ea6de) |
| Cross-Text Connections HARD #6 | `cmsjro21w03eaqmt1hykdprlg` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASSAGE HARD.pdf p6 (Question ID f7c02e89) |
| Cross-Text Connections HARD #7 | `cmsjro21z03efqmt1oe4c9y1t` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASSAGE HARD.pdf p8 (Question ID 96f3accc) |
| Cross-Text Connections HARD #9 | `cmsjro22603epqmt1ibgunfkt` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASSAGE HARD.pdf p11 (Question ID 6a1dc7c5) |
| Cross-Text Connections HARD #11 | `cmsjro22c03ezqmt1o87yfmft` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASSAGE HARD.pdf p13 (Question ID d0198544) |
| Cross-Text Connections MEDIUM #6 | `cmsjro2py03mgqmt15szncef4` | Question.explanation | explanation_glyph_displacement | DOUBLE PASSAGE/ANS DOUBLE PASS MED.pdf p6 (Question ID 03080769) |
| Text Structure and Purpose HARD #4 | `cmsjro38603z8qmt11brkhrmr` | Question.explanation | explanation_glyph_displacement | TEXT STRUCTURE AND PURPOSE/ANS TEXT STRUCT PURPOSE HARD.pdf p4 (Question ID c61a7c4a) |
| Text Structure and Purpose HARD #8 | `cmsjro38m03zsqmt17pvd2ix5` | Question.explanation | explanation_glyph_displacement | TEXT STRUCTURE AND PURPOSE/ANS TEXT STRUCT PURPOSE HARD.pdf p9 (Question ID 4ed09415) |
| Text Structure and Purpose HARD #13 | `cmsjro396040hqmt10psiyotr` | Question.explanation | explanation_glyph_displacement | TEXT STRUCTURE AND PURPOSE/ANS TEXT STRUCT PURPOSE HARD.pdf p15 (Question ID ad4f7362) |
| Text Structure and Purpose MEDIUM #7 | `cmsjro2ra03nuqmt1hsrovf77` | Question.explanation | explanation_glyph_displacement | TEXT STRUCTURE AND PURPOSE/ANS TEXT STUCT PURPOSE MED.pdf p7 (Question ID c6bd3447) |
| Words in Context EASY #4 | `cmsjro39s0416qmt1kghutk5s` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p4 (Question ID 45a109a3) |
| Words in Context EASY #7 | `cmsjro3a4041lqmt1uvzb9bws` | Question.explanation | explanation_glyph_displacement | WORDS IN CONTEXT/ANS WORDS CONTEXT EASY.pdf p7 (Question ID e386a11d) |
| Words in Context EASY #10 | `cmsjro3af0420qmt1k6txturq` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p10 (Question ID a0777403) |
| Words in Context EASY #12 | `cmsjro3dr042aqmt1s03xaohd` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p12 (Question ID 0f040c50) |
| Words in Context EASY #19 | `cmsjro3en0439qmt1o8pi3z26` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p19 (Question ID 9ccf463e) |
| Words in Context EASY #32 | `cmsjro3g00452qmt1tjzkznkw` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p32 (Question ID 37219ba2) |
| Words in Context EASY #40 | `cmsjro3gs0466qmt1yx4vdrdc` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p40 (Question ID 6cf906fc) |
| Words in Context EASY #40 | `cmsjro3gs0466qmt1yx4vdrdc` | Question.explanation | explanation_glyph_displacement | WORDS IN CONTEXT/ANS WORDS CONTEXT EASY.pdf p40 (Question ID 6cf906fc) |
| Words in Context EASY #41 | `cmsjro3gw046bqmt1s1bsduip` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p41 (Question ID 4480fae9) |
| Words in Context EASY #43 | `cmsjro3h2046lqmt1204wvw4l` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p43 (Question ID e3ffb854) |
| Words in Context EASY #47 | `cmsjro3hh0475qmt1yd8qruhr` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p47 (Question ID 84f9b577) |
| Words in Context EASY #55 | `cmsjro3mj0489qmt1hsai5rqz` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p55 (Question ID 6286dd96) |
| Words in Context EASY #60 | `cmsjro3o9048yqmt10z7r4pux` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p60 (Question ID edd64a4a) |
| Words in Context EASY #62 | `cmsjro3ol0498qmt1cx59hde0` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p62 (Question ID 9671d61d) |
| Words in Context EASY #63 | `cmsjro3oq049dqmt1jwz1uo2h` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p63 (Question ID ba974387) |
| Words in Context EASY #64 | `cmsjro3ou049iqmt15o7i7ckz` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p64 (Question ID 05575bca) |
| Words in Context EASY #66 | `cmsjro3p4049sqmt1lj9z6088` | Question.stem | glued_words | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p66 (Question ID 04e4c51d) |
| Words in Context EASY #72 | `cmsjro3ps04amqmt1jh539dee` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p72 (Question ID 417f8dfa) |
| Words in Context EASY #74 | `cmsjro3pz04awqmt13zm390ui` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p74 (Question ID 1695391a) |
| Words in Context EASY #79 | `cmsjro3qi04blqmt1xqb702ha` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p79 (Question ID cf9a3f34) |
| Words in Context EASY #86 | `cmsjro3s404ckqmt19x6ura4f` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p86 (Question ID 10a409bd) |
| Words in Context EASY #91 | `cmsjro3sl04d9qmt1fjdn99d3` | Question.explanation | glued_words | WORDS IN CONTEXT/ANS WORDS CONTEXT EASY.pdf p92 (Question ID bcd924a5) |
| Words in Context EASY #100 | `cmsjro5am055zqmt14819fdt1` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p100 (Question ID aa7ae735) |
| Words in Context EASY #105 | `cmsjro5b6056oqmt1ifxzbe42` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p105 (Question ID c2c26e20) |
| Words in Context EASY #107 | `cmsjro5be056yqmt101usbnvf` | Question.stem | dollar_escape | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p107 (Question ID 3118ca93) |
| Words in Context EASY #109 | `cmsjro5bl0578qmt1j8dqc6wk` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p109 (Question ID b622fb78) |
| Words in Context EASY #115 | `cmsjro5c60582qmt1v18x13z7` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p115 (Question ID 82b7c3b2) |
| Words in Context EASY #116 | `cmsjro5cb0587qmt10zmpqy5p` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p116 (Question ID e1e89221) |
| Words in Context EASY #117 | `cmsjro5ew058cqmt1qda4g31k` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p117 (Question ID b11bb2a3) |
| Words in Context EASY #124 | `cmsjro5g5059bqmt1tuxiqwq3` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p124 (Question ID 2c82068f) |
| Words in Context EASY #126 | `cmsjro5gc059lqmt1kwr3wiqx` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p126 (Question ID 213248f7) |
| Words in Context EASY #130 | `cmsjro5gq05a5qmt1yprdr8d1` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT EASY.pdf p130 (Question ID 5d48f889) |
| Words in Context HARD #8 | `cmsjro5iy05dcqmt1kmse5vny` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT HARD.pdf p8 (Question ID e459076b) |
| Words in Context HARD #15 | `cmsjro5jn05ebqmt1k76p72o6` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT HARD.pdf p15 (Question ID 7f935017) |
| Words in Context HARD #16 | `cmsjro5mz05egqmt1y1cht2d8` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT HARD.pdf p16 (Question ID be94c9fc) |
| Words in Context HARD #17 | `cmsjro5nb05elqmt1mbqd3bp6` | Question.explanation | explanation_glyph_displacement | WORDS IN CONTEXT/ANS WORDS CONTEXT HARD.pdf p17 (Question ID 54804e10) |
| Words in Context HARD #18 | `cmsjro5nm05eqqmt1bpquwcst` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT HARD.pdf p18 (Question ID 9b22bf7b) |
| Words in Context HARD #26 | `cmsjro5os05fuqmt12e220q5d` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT HARD.pdf p26 (Question ID 3566120b) |
| Words in Context HARD #53 | `cmsjro5s005jlqmt1oowpb9zp` | Question.explanation | explanation_glyph_displacement | WORDS IN CONTEXT/ANS WORDS CONTEXT HARD.pdf p53 (Question ID b35e2fdc) |
| Words in Context MEDIUM #1 | `cmsjro4r404s8qmt1x2sqqd5w` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p1 (Question ID 359902ae) |
| Words in Context MEDIUM #6 | `cmsjro4sm04sxqmt1iozurw2x` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p6 (Question ID 84ece3f6) |
| Words in Context MEDIUM #16 | `cmsjro4tt04ubqmt1vn5b01cb` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p16 (Question ID 9aa44886) |
| Words in Context MEDIUM #17 | `cmsjro4tx04ugqmt1ldd5x5x0` | Question.stimulus | glued_words+lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p17 (Question ID ab1bd603) |
| Words in Context MEDIUM #35 | `cmsjro4yu04wyqmt1lmamu0nj` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p35 (Question ID 62a18353) |
| Words in Context MEDIUM #38 | `cmsjro4z704xdqmt1xcep6lzi` | Question.stimulus | lost_underline | WORDS IN CONTEXT/WORDS CONTEXT MED.pdf p38 (Question ID b4c6cff6) |
| Words in Context MEDIUM #38 | `cmsjro4z704xdqmt1xcep6lzi` | Question.explanation | glued_words | WORDS IN CONTEXT/ANS WORDS CONTEXT MED.pdf p38 (Question ID b4c6cff6) |

## needs_review

None. WIC MEDIUM #17, which the earlier run had flagged because of the glued "considerthem", was resolved from the source and is fixed above.
