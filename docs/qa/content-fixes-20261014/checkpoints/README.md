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

Still open: escaped blanks `\_\_\_\_\_` in practice sets; other PS explanations possibly cut at PDF page breaks
(explanation_truncated pass); Nonlinear eq MED #9 table header = first step row (cosmetic).
