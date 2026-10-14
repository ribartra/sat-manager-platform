# Checkpoints — practice-set explanations with stripped math (2026-10-14)

86 heuristic candidates (scratch `psx/{adv,alg,geo,psda}.json`), one agent per domain. Each agent appends one JSON line
per finished question to `checkpoints/ps-<area>.jsonl`:
`{"id","status":"fixed|false_positive|needs_review","op":{guarded op}|null,"evidence"}` — a restarted agent skips ids
already there. The final spec `specs/ps-<area>.json` is built from the checkpoint.

| Area | Candidates | State |
|---|---|---|
| Geometry and Trigonometry | 12 | DONE — 12 fixed (specs/ps-geo.json, ps-geo-findings.md) |
| Advanced Math | 28 | run 1 cut off (session limit) — relaunched |
| Algebra | 22 | run 1 cut off (session limit) — relaunched |
| Problem-Solving and Data Analysis | 24 | run 1 cut off (session limit) — relaunched |
