# PS round 2: Writing / Expression of Ideas (2026-10-14)

Scope: `filterSets(resolveWritingPracticeSets(db), {domain:"Expression of Ideas"})`, which is 6 sets and 118 questions:
- Rhetorical Synthesis: EASY 18, MEDIUM 30, HARD 21
- Transitions: EASY 20, MEDIUM 14, HARD 15

All are MC. dev.db was opened read-only.

Outputs:
- spec: `specs/ps2-eoi.json` (24 guarded ops on 23 questions)
- checkpoint: `checkpoints/ps2-eoi.jsonl` (118 lines: 23 fixed, 95 clean, 0 needs_review)

## Counts by class

| Class | Ops | Questions |
|---|---|---|
| notes_bullets: a Rhetorical Synthesis note hard-wrapped mid-sentence, so the wrapped tail reads as an extra note | 19 (`Question.stimulus`) | 19 |
| glued_words: words glued together, or a line-break hyphen left as "x- y" | 6 (2 stem, 1 stimulus merged with a notes op, 3 option) | 6 |
| **Total** | **24 ops** (HARD RS #2 merges both classes into one stimulus op) | **23** |

Not found, 0 of each:
- neighbour bleed or passage appended/replaced
- passage missing its first sentence
- notes flattened onto one line
- missing notes intro (MEDIUM RS #29 has no "While researching…" intro, but neither does the source, so it is clean)
- options in the stem
- options shortened or paraphrased
- MC with fewer than 4 options
- missing `______` (49/49 Transitions stems have it)
- flattened tables
- stripped math
- truncated, footer-leaked or shifted explanations
- UI/OCR artifacts
- `correctAnswer` mismatches

## Fixes

| Set / # | id | Field | Class | Fix | Source |
|---|---|---|---|---|---|
| Rhetorical Synthesis EASY #7 | `cmsjro6ky060oqmt1kdnevgni` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p7 (296801d2) |
| Rhetorical Synthesis EASY #9 | `cmsjro6l7060yqmt1n6f00lqf` | Question.stem | glued_words | missing space between the goal sentence and the question (“My Ántonia. Which choice…”) | ANS p9 (00460c13) |
| Rhetorical Synthesis EASY #10 | `cmsjro6lb0614qmt150y9hyov` | QuestionOption.text | glued_words | option A glued “livedapproximately” | ANS p10 (f4b63a04) |
| Rhetorical Synthesis HARD #2 | `cmsjro68005q9qmt1og2zc1rq` | Question.stimulus | notes_bullets+glued_words | note lines hard-wrapped mid-sentence; joined; title glued “Narrativeof” | ANS p2 (6c9df5d1) |
| Rhetorical Synthesis HARD #4 | `cmsjro68805qjqmt14hby1a52` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p4 (b07a7634) |
| Rhetorical Synthesis HARD #5 | `cmsjro68c05qoqmt1je3zltfp` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p5 (3fa48bf3) |
| Rhetorical Synthesis HARD #6 | `cmsjro68g05qtqmt1gk9r3q2a` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p6 (8fe4f4ab) |
| Rhetorical Synthesis HARD #7 | `cmsjro68k05qyqmt1msw8ln5p` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p7 (964c6055) |
| Rhetorical Synthesis HARD #11 | `cmsjro68y05riqmt10quvi2n8` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p11 (fdd9a360) |
| Rhetorical Synthesis HARD #12 | `cmsjro69105rnqmt1d795cbd9` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p12 (10cd0327) |
| Rhetorical Synthesis HARD #13 | `cmsjro69605rsqmt1nxq6d0h1` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p13 (5b8b69a2) |
| Rhetorical Synthesis HARD #15 | `cmsjro69f05s2qmt1s5fs40x4` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p15 (3dcc7140) |
| Rhetorical Synthesis HARD #17 | `cmsjro69n05scqmt12ft2maig` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p17 (5645f119) |
| Rhetorical Synthesis HARD #17 | `cmsjro69n05sdqmt1vut5e8of` | QuestionOption.text | glued_words | line-break hyphen left as “market- quality” | ANS p17 (5645f119) |
| Rhetorical Synthesis HARD #18 | `cmsjro69r05skqmt1iyuiswud` | QuestionOption.text | glued_words | line-break hyphen left as “self- governance” | ANS p18 (87d34a39) |
| Rhetorical Synthesis MEDIUM #1 | `cmsjro6ad05t1qmt1flx6uew4` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p1 (b46e0c8a) |
| Rhetorical Synthesis MEDIUM #6 | `cmsjro6b205tqqmt1iqniqqfd` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p6 (6249b173) |
| Rhetorical Synthesis MEDIUM #11 | `cmsjro6bu05ufqmt1e8b01q4i` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p11 (85c0c0f0) |
| Rhetorical Synthesis MEDIUM #13 | `cmsjro6c305upqmt15euzg8rc` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p13 (bce57278) |
| Rhetorical Synthesis MEDIUM #15 | `cmsjro6ca05uzqmt18lsl5g55` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p15 (5d3177aa) |
| Rhetorical Synthesis MEDIUM #20 | `cmsjro6fn05voqmt1xjw9hwd8` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p20 (25755def) |
| Rhetorical Synthesis MEDIUM #22 | `cmsjro6fz05vyqmt1sh8p1o8q` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p22 (a1ca7ec4) |
| Rhetorical Synthesis MEDIUM #26 | `cmsjro6gn05wiqmt1w4q9hgbl` | Question.stimulus | notes_bullets | note lines hard-wrapped mid-sentence; joined | ANS p26 (ed80971c) |
| Transitions HARD #9 | `cmsjro64b05p3qmt1vniw6igl` | Question.stem | glued_words | glued “thegreater” | ANS p9 (176edca6) |

Every op has the evidence file path. ANS PDFs are under `files_to_load/PRACTICE EXERCISES/EXERCISES WRITING/{Student Notes,Transitions}/…`. The notes wraps were confirmed on the rendered page (for example SN Hard p2: "…both sides of the / Atlantic." is one bullet).

## needs_review

None.

## What was checked

**Method.** Each question was matched to its ANS PDF block and its exercise PDF block by Question ID (`pdftotext` non-layout, `Question ID:?`). All 118 IDs were found in both files. The comparisons were:
- stimulus+stem against the "Question" block
- each option against its "A./B./C./D." line
- `explanation` against "Rationale", with the "Question Difficulty:" and Assessment footer stripped

The comparisons were run at three levels: word level, punctuation-preserving with whitespace and quote/dash glyphs ignored, and order-insensitive. The PDF text layer scatters ’, –, —, “ ” and combining accents (Á ntonia, S ámi). Every remaining difference was looked at by hand. All of them were glyph-order artifacts of the PDF text layer, except the 6 glued_words.

**Results.**
- **Keys:** the ANS "Correct Answer" equals `correctAnswer` for 118/118.
- **Explanations:** each one opens with "Choice <key> is the best answer" for 118/118, so none is shifted. All 118 match the ANS rationale for the same ID with the same punctuation, so nothing is truncated and no footer leaked.
- **Notes:** a notes check on the `-layout` text confirmed that every note is present, in order, on its own line. The intro sentence is present in 68/69 notes questions; the one without it is MEDIUM #29, matching its source.

## Observations, no op

1. **PS notes carry no bullet markers.** They are one note per line, rendered with `whitespace-pre-wrap`. The FPT convention is "- " bullets, and titles are not italicised (no `*…*`). Both apply to every PS notes question, so changing them belongs in a corpus-wide pass, not in this area.
2. **Stems and explanations keep the PDF hard line wraps.** This is systemic across practice sets. Two wraps fall right after a hyphen: Transitions HARD #11 "ever-⏎shifting" (stem) and Transitions EASY #9 "cause-and-⏎effect" (explanation). They render as ordinary wraps and were left with the rest.
3. **Chemical subscripts are flattened** as "NH3", "N2", "H2" (RS EASY #2). The source sets them as subscripts. The text is unambiguous, so it was left alone.
4. **Set order differs from the PDF order in 3 sets.** The PDF's first question sits later in the set:
   - RS MEDIUM: PDF #1 `81315093` is set #17
   - Transitions EASY: PDF #1 `56336696` is set #16
   - Transitions MEDIUM: PDF #1 `30438650` is set #6

   The rest keep their relative order. This is order only: content and keys are aligned by ID.

Scratch scripts: `scratchpad/ps2/eoi/`:
- `parse.cjs`, `cmp.cjs`, `canon*.cjs`, `glue.cjs`, `notes.cjs`: detection
- `build.cjs`: builds the spec
- `validate.cjs`: spec validation (before == DB, after != before, balanced `$`, KaTeX, no correctAnswer, no overlap with other specs: all pass)
