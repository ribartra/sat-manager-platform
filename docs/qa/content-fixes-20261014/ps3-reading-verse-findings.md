# PS3 Reading — verse / protected-block line breaks (2026-10-14)

Read-only on dev.db. Scope: the 7 fields in `specs/ps3-reading-review.json`, plus every Reading practice question
(Information and Ideas, Craft and Structure) whose stimulus contains "poem" or has 3 or more consecutive lines under 90 chars.
That is 44 questions and 45 fields. Each field was checked against its exercise-PDF page: the "Question ID <hex>" was confirmed in
`pdftotext -raw`, and the poem pages were rendered with `pdftoppm -r 110`.

## Findings

- **8 ops** (`specs/ps3-reading-verse.json`, class `pdf_hard_wrap_verse`). All are whitespace-only and every `before` equals dev.db:
  - 6 poem intros (Dido/Aeneid, Martí, McKay "Morning Joy", Sonnet 27, Pogue Johnson, Sackville-West): the full-width
    prose intro wraps at the right margin. Each wrap is joined. All indented verse lines are kept.
  - De Acosta "Spring and You" (Words in Context EASY #129): "hair," and "flower." have a deeper hanging indent (about
    101px, against 73px for the verse lines). They are runover lines of the verse line above, so both are joined. The
    poem now has 4 verse lines.
  - Command of Evidence EASY #9 **stem**: "room to / be cooler" is a prose wrap, so it is joined.
- **37 clean.**
  - The other 6 verse excerpts (Rihani, McClellan, Gilman, Lowell, Cullen, Rossetti): every line is a real verse line.
    There are no runover indents, and the alternating indents only reflect the rhyme layout.
  - The 5 one-line "… is a poem by …" stimuli have no verse to check.
  - In the 26 table stimuli, the protected block is a markdown table, so the row breaks are real.
- **0 needs_review.**

## Observations (not changed, outside this scope)

- **Missing stanza breaks.** The source shows a blank line between stanzas in Sackville-West "Evening" (4|4|4),
  Pogue Johnson (4|4), Martí (4|4) and McKay "Morning Joy" (4|4). dev.db has no blank line there. Adding them would be
  whitespace-only, if wanted.
- **Sentence-final prose wraps after tables.** These were kept by `unwrap-ps.cjs` because the line ends a sentence, but
  the source shows they are mid-paragraph PDF wraps:
  - CE EASY #13: "locations. / In each case"
  - CE EASY #28: "neighborhoods. / They're"
  - CE EASY #33: "state. / Looking"
  - CE HARD #28: "wastewater. / ++However…++"

  CE MED #25 "rounding." is a real table-note line.
