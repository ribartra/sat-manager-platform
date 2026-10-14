# TEST 1 — bleed / options-in-stem / flattened-table audit (2026-10-14)

Read-only scan of the 98 published questions (RW M1/M2 27+27, Math M1/M2 22+22) in module order,
comparing each question with N-1 and N+1. Every hit was checked against the source image
(`MATH/TEST 1 INNOVATOR MATH MOD 1 AND 2.pdf`; `Reading and Writing/ Test 1 Module 1, 2B R&W.docx` → PDF,
plus `Test1 RW Answer Explanations.docx`). Ops: `specs/test-01.json` (21 guarded ops, `before` read from dev.db
and re-checked). No answer keys are changed.

## Counts

| Class | Questions | Ops |
|---|---|---|
| bleed | 1 | 4 |
| options_in_stem | 0 | 0 |
| flattened_table | 0 | 0 |
| other | 15 | 17 |
| **Total** | **16** | **21** |

needs_review: none.

## Findings

| Module | # | Question id | Class | What | Fix | Evidence |
|---|---|---|---|---|---|---|
| Math M2 | 8 | cmsjrntl50084qmt1hc5osyku | bleed | All 4 options are #7's fractions (7/27, 7/16, 7/11, 7/8). The OCR page artifact and the candidate already had the bleed | The 4 options become the source points (½, 1⅔), (1⅔, −5), (2, −6⅓), (5, −5¼). Key C still checks out | Math PDF p.10 |
| Math M2 | 12 | cmsjrntn6008kqmt1kjoqv4xn | other | Exponent was OCR'd as `2x^2`; the source has `2x^3`. With `x^2` the key (4) cannot be reached | `a^{2x^2}` → `a^{2x^3}` | Math PDF p.12 (500 dpi) |
| Math M2 | 3 | cmsjrnti6007iqmt1mbb06uid | other | Degree sign came through as `w^*` | `w^*` → `w^\circ` (3 times) | Math PDF p.9 |
| Math M2 | 19 | cmsjrntp10096qmt18e3tdg19 | other | The currency `$` signs pair up with the `$p$` delimiters, so the page shows "value of p$?" | The final `$p$` becomes `*p*` | Math PDF p.14; renderer tokenization |
| RW M2 | 22 | cmsjro6zs063jqmt1tbq9ks7f | other | Option letter leaked into options A ("A pilot error…") and D ("D a discovery…") | Letters removed | RW PDF p.31; Answer Explanations docx |
| RW M1 | 11 | cmsjro6up062wqmt1xl1noqst | other | Option C ends with a stray " -" | Removed | RW PDF p.6 |
| RW M1 | 25 | cmsjro71e063oqmt1o35w3kgi | other | Options B and C end with a stray " -". The notes list in the stimulus is flattened onto one line | Dashes removed; one bullet per line | RW PDF p.14 |
| RW M1 | 26, 27 | cmsjro71p063qqmt1keboinuy, cmsjro71y063sqmt19xsrpx6b | other | Notes list flattened onto one line | One bullet per line (5 and 6 bullets) | RW PDF p.15, p.16 |
| RW M2 | 27 | cmsjro725063tqmt1hnfcs3et | other | Notes list flattened onto one line | One bullet per line (5 bullets) | RW PDF p.35 |
| RW M1 | 3, 17, 23 | cmsjro6rj062gqmt1oqq2nq4j, cmsjro6wh0638qmt1huhh5s6l, cmsjro70i063kqmt1zlfv8shx | other | Blank stored as `\_\_\_\_\_`; it shows up with literal backslashes | `_____` | source blank; renderer has no markdown escapes |
| RW M2 | 25 | cmsjro71h063pqmt1t05jqp02 | other | Same escaped blank | `_____` | same |
| RW M1 | 6 | cmsjro6t2062mqmt1ygsnfw41 | other | Escaped footnote `\*` breaks italics: most of the passage renders in italics and backslashes show | `*doux pays de France**`; the footnote goes on its own line, as in the source | RW PDF p.3 |

## Checked, no action

- **Template stems.** RW neighbours share stem templates ("Which choice completes the text…", "While researching a topic…"). These are not bleed.
- **Tables.** No flattened tables in TEST 1. Math M2 #7 (coffee table), RW M1 #10 and RW M2 #12 (graphs) show their content as images.
- **Cross-out marks.** No "×" or A)–D) option runs inside any stem or stimulus.
- **RW M1 #1.** The "1965" (should be 1865) is in the source itself; left as-is.
- **Math M1 #19.** "4.9 billion (or 10⁹)" is faithful to the source.
- **Math explanations.** All 44 Math explanations are NULL. That is out of scope here, but they are missing content.
- **Escaped blanks across the bank.** 31 bank-wide questions contain `\_\_` (escaped blanks). A renderer-side unescape would fix them all.
