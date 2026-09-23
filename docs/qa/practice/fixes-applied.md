# Fixes aplicados — recovery-map (2026-09-23T04:10:57.855Z)

Specs: `/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/d30b86b4-f1c4-46b9-8d72-8b9fea94d0e9/scratchpad/practice-fixes`. Backup previo en `backups/devdb-preapply-*`. Dev server detenido. Raw better-sqlite3 + WAL checkpoint.

- **Nonlinear Functions MEDIUM p27** (Advanced Math) correctAnswer: `2` → `2.5|5/2`  (ANS: 'The correct answer is 2.5' (halving 20->10->5->2.5))
- **Nonlinear Functions MEDIUM p21 (Moore)** (Advanced Math) correctAnswer: `D` → `B`  (ANS: 'Correct Answer: B' = 1989 (275k in 1985 doubles every 2yr -> 1.1M in 1989); opts A1987 B1989 C1991 D1994)
- **Linear Functions MEDIUM seq1** (Algebra) correctAnswer: `2` → `2.6|13/5`  (ANS: 'The correct answer is 2.6' (0.6+4*0.5))
- **Linear Eq 2-Var HARD seq2** (Algebra) correctAnswer: `1` → `1.5|3/2`  (ANS: 'The correct answer is 1.5' (0.10x=0.15 -> x=1.5); decimal truncation)
- **Linear Eq 2-Var HARD seq4** (Algebra) correctAnswer: `1` → `1.25|5/4`  (ANS: 'The correct answer is 1.25'; decimal truncation (broken_question equation fix deferred to content phase))
- **Linear Eq 2-Var HARD seq12** (Algebra) correctAnswer: `1` → `1.5|3/2`  (ANS: 'The correct answer is 1.5' (16 carnations=$24 -> $1.50); decimal truncation)
- **Lines/Angles/Triangles HARD seq7** (Geometry & Trigonometry) correctAnswer: `4` → `4.5|9/2`  (ANS: 'The correct answer is 4.5. BD divides ABC into similar triangles ... 4.5 and 9/2')
- **One-Variable Data HARD seq2** (PSDA (One-Var Data)) correctAnswer: `2` → `2.6|13/5`  (ANS: 'The correct answer is 2.6' (17.4-14.8 means diff))
- **One-Variable Data MEDIUM seq10** (PSDA (One-Var Data)) correctAnswer: `1` → `1.3|13/10`  (ANS: 'The correct answer is 1.3' (median 47.7 - 46.4))
- **Ratios MEDIUM seq13** (PSDA (Ratios)) correctAnswer: `4` → `4.44`  (ANS: 'The correct answer is 4.44' (density*unit price))
- **Ratios MEDIUM seq14** (PSDA (Ratios)) correctAnswer: `25` → `25.4|127/5`  (ANS: 'The correct answer is 25.4 ... and 127/5' (11 miles / total time))

## WAL
checkpoint: `[{"busy":0,"log":0,"checkpointed":0}]`
integrity: `[{"integrity_check":"ok"}]`
