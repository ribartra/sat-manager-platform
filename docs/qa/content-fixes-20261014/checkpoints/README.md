# Checkpoints — practice-set explanations with stripped math (2026-10-14)

86 heuristic candidates (scratch `psx/{adv,alg,geo,psda}.json`), one agent per domain. Each agent appends one JSON line
per finished question to `checkpoints/ps-<area>.jsonl`:
`{"id","status":"fixed|false_positive|needs_review","op":{guarded op}|null,"evidence"}` — a restarted agent skips ids
already there. The final spec `specs/ps-<area>.json` is built from the checkpoint.

| Area | Candidates | State |
|---|---|---|
| Geometry and Trigonometry | 12 | DONE — 12 fixed (specs/ps-geo.json, ps-geo-findings.md) |
| Advanced Math | 28 | DONE — 28 fixed (specs/ps-adv.json, ps-adv-findings.md) |
| Algebra | 22 | DONE — 21 fixed + EASY #13 resolved by main session with prose `\$` (specs/ps-extra.json; renderer now supports `\$`) |
| Problem-Solving and Data Analysis | 24 | DONE — 23 fixed (specs/ps-psda.json) + Percentages EASY #14 by main session with prose `\$` (specs/ps-extra.json); One-var EASY #15 and Two-var MED #11 also get their last Choice paragraph (next PDF page, verified with pdftotext) |

## Apply log

| Target | Backup | Result |
|---|---|---|
| dev.db | `backups/devdb-pre-content-fixes-20261014-ps.db` | 86/86 applied, re-run 86 ALREADY, quick_check ok (commit 387a854) |
| prod code | — | web `ws-20261014-dollar-escape` deployed first (renderer `\$`), health ok, VM disk 40% |
| prod DB | `/db/backups/dev.db.pre-content-fixes-20261014-ps` | dry-run 86 PENDING (no drift/MISSING), applied 86/86, re-run 86 ALREADY, quick_check ok, health ok |

Round-1 open items closed in round 2 below (escaped blanks were already 0 bank-wide).

## Round 2 — practice sets, full brief (2026-10-14)

One agent per area, brief in `ps2-brief.md`, checkpoints `checkpoints/ps2-<area>.jsonl` (one line per question; restarted
agents resumed from them after the session-limit cut). Specs `specs/ps-trunc.json` + `specs/ps2-<area>.json`, merged into
`spec-ps2.json`.

| Area | Questions | Fixed | Ops | Main classes |
|---|---|---|---|---|
| Pending items (main session) | — | 16 | 16 | 15 SEC "Question Difficulty" footers; Nonlinear eq MED #9 headerless table |
| Algebra | 266 | 53 | 59 | stripped math, stray `#`, `$` currency, `![img-N]` option text, `\mathcal{P}`→`\ell` |
| Advanced Math | 207 | 75 | 88 | Unicode/garbled math, page-break tails, 3 hand-written explanations → ANS, 1 flattened table |
| Geometry and Trigonometry | 142 | 17 | 18 | stripped math, 2 page-break tails |
| Problem-Solving and Data Analysis | 211 | 89 | 90 | stripped math, 11 page-break tails, 1 flattened table |
| Information and Ideas | 204 | 27 | 30 | displaced ’/— in earlier-appended tails, glued words, vicu ñas |
| Craft and Structure | 325 | 55 | 57 | 38 lost underlines, displaced ’/—, glued words |
| Standard English Conventions | 141 | 4 | 4 | glued words at italic titles |
| Expression of Ideas | 118 | 23 | 24 | notes hard-wrapped mid-sentence, glued words |
| **Total** | 1614 | | **386** | needs_review: 0 |

Code (commit 9489357): headerless pipe tables render without `<thead>`; image-only answer choices (8 graph questions,
previously shown as a numeric field) count as options and render in the players/results (`components/option-content.tsx`).

| Target | Backup | Result |
|---|---|---|
| dev.db | `backups/devdb-pre-content-fixes-20261014-trunc.db` (pre-round) | 386/386 applied, re-run ALREADY, integrity ok |
| prod code | — | web `ws-20261014-image-options` (built from a clean HEAD export) deployed first, healthy; VM disk 51% |
| prod DB | `/db/backups/dev.db.pre-content-fixes-20261014-ps2` | 6 option ids differ in prod → remapped by (questionId,label) with text===before (`spec-ps2-prod-option-remap.json`); 386 PENDING → applied, re-run 386 ALREADY, quick_check ok, health ok |
