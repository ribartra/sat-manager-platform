# PS round 2: Advanced Math (Math practice sets) findings

Area `adv`: `filterSets(resolveMathPracticeSets(db), {domain:"Advanced Math"})`.
That is 9 sets and 207 questions: Equivalent expressions - EASY 21, Equivalent expressions - HARD - #1 20, Equivalent expressions - MEDIUM 23, Nonlinear equations - EASY 15, Nonlinear equations - HARD - #1 11, Nonlinear equations - MEDIUM 30, Nonlinear functions - EASY 17, Nonlinear functions - HARD 36, Nonlinear functions - MEDIUM 34.
dev.db was opened read-only. All 207 questions are in `checkpoints/ps2-adv.jsonl` (resumed from a run cut off by a rate limit; the scratch work in `scratchpad/ps2/adv/` was reused, and the remaining 24 work items were finished).

## Counts by class

| class | questions | ops |
| --- | --- | --- |
| wrong_explanation | 5 | 5 |
| broken_math | 68 | 80 |
| artifact | 7 | 7 |
| explanation_truncated | 12 | 12 |
| flattened_table | 1 | 1 |
| neighbour bleed / concatenation | 0 | 0 |
| options in stem / fewer than 4 options | 0 | 0 |
| wrong key | 0 | 0 (keys are never changed) |

An op can carry more than one class (for example `broken_math+explanation_truncated`).
Totals: 132 clean, 75 fixed, 0 needs_review. Spec: `specs/ps2-adv.json` (88 ops: 78 Question, 10 QuestionOption).

## Fixes

| set / # | id | field | class | source |
| --- | --- | --- | --- | --- |
| Equivalent expressions - EASY #5 | cmsp3qmyy00050vmta16uld6t (60fdb4d4) | explanation | wrong_explanation | ANS Equivalent Expression EASY.pdf p5 (60fdb4d4) |
| Equivalent expressions - EASY #8 | cmsjrnxnj01joqmt1zzb04itx (9ed9f54d) | explanation | broken_math | ANS Equivalent Expression EASY.pdf p8 (9ed9f54d) |
| Equivalent expressions - EASY #10 | cmsp3qmz900060vmtr0uq7tw0 (294db8ec) | explanation | wrong_explanation | ANS Equivalent Expression EASY.pdf p10 (294db8ec) |
| Equivalent expressions - EASY #14 | cmsp3qmzm00070vmte55ld69n (974d33dc) | explanation | wrong_explanation | ANS Equivalent Expression EASY.pdf p14 (974d33dc) |
| Equivalent expressions - EASY #16 | cmsjrnxoe01kiqmt121bhg3r0 (0354c7de) | explanation | broken_math | ANS Equivalent Expression EASY.pdf p16 (0354c7de) |
| Equivalent expressions - EASY #17 | cmsjrnxoh01knqmt13f79t756 (e597050f) | explanation | broken_math | ANS Equivalent Expression EASY.pdf p17 (e597050f) |
| Equivalent expressions - HARD - #1 #4 | cmsjrnxew01f5qmt1zio91es6 (ea6d05bb) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p6 (ea6d05bb) |
| Equivalent expressions - HARD - #1 #5 | cmsjrnxey01f6qmt195edjlx1 (137cc6fd) | explanation | broken_math+artifact | ANS HARD 1EQUIV EXPRES .pdf p7 (137cc6fd) |
| Equivalent expressions - HARD - #1 #6 | cmsjrnxf301f7qmt1nonlvtfi (34847f8a) | explanation | broken_math+explanation_truncated | ANS HARD 1EQUIV EXPRES .pdf p8-p9 (34847f8a) |
| Equivalent expressions - HARD - #1 #8 | cmsjrnxf901fcqmt1s9hy79ai (c3b116d7) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p11 (c3b116d7) |
| Equivalent expressions - HARD - #1 #9 | cmsjrnxfc01fhqmt1konl0m7t (5355c0ef) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p13 (5355c0ef) |
| Equivalent expressions - HARD - #1 #10 | cmsjrnxfg01fiqmt193ts5mkl (c81b6c57) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p14 (c81b6c57) |
| Equivalent expressions - HARD - #1 #14 | cmsjrnxfu01fwqmt10doytpcg (ad038c19) | stem | artifact | ANS HARD 1EQUIV EXPRES .pdf p21 (ad038c19) |
| Equivalent expressions - HARD - #1 #15 | cmsjrnxfy01g1qmt1ebe6kh0n (42f8e4b4) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p23 (42f8e4b4) |
| Equivalent expressions - HARD - #1 #17 | cmsjrnxg501g7qmt1tkea9b5o (89fc23af) | stem | artifact+broken_math | ANS HARD 1EQUIV EXPRES .pdf p26 (89fc23af) |
| Equivalent expressions - HARD - #1 #19 | cmsjrnxgc01gdqmt1cbnrw710 (f89e1d6f) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p29 (f89e1d6f) |
| Equivalent expressions - HARD - #1 #20 | cmsjrnxgg01giqmt1k4jeu9kq (e117d3b8) | explanation | broken_math | ANS HARD 1EQUIV EXPRES .pdf p30 (e117d3b8) |
| Equivalent expressions - MEDIUM #1 | cmsjrnxrg01n5qmt14fgtzc46 (c602140f) | explanation | broken_math | Ans Equivalent Expressions MED.pdf p1 (c602140f) |
| Equivalent expressions - MEDIUM #3 | cmsjrnxrn01nfqmt1x6f0p2jc (8838a672) | explanation | artifact | Ans Equivalent Expressions MED.pdf p3 (8838a672) |
| Nonlinear equations - EASY #3 | cmsjrnxwy01paqmt1dt9pxwng (98f735f2) | stem | broken_math | ANS Non Linear Equations EASY.pdf p3 (98f735f2) |
| Nonlinear equations - EASY #3 | cmsjrnxwy01paqmt1dt9pxwng (98f735f2) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p3 (98f735f2) |
| Nonlinear equations - EASY #4 | cmsjrnxx401pbqmt18tur3bai (eb268057) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p4 (eb268057) |
| Nonlinear equations - EASY #6 | cmsjrnxxc01pgqmt1m2fn7lmi (b76a2815) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p6 (b76a2815) |
| Nonlinear equations - EASY #7 | cmsjrnxxf01phqmt1fsh7fx65 (d0e8e8f5) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p7 (d0e8e8f5) |
| Nonlinear equations - EASY #11 | cmsjrnxxt01ppqmt1wfmg9gz2 (3de7a7d7) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p11 (3de7a7d7) |
| Nonlinear equations - EASY #15 | cmsjrnxyf01q5qmt18o5btlqb (3c95093c) | explanation | broken_math | ANS Non Linear Equations EASY.pdf p15 (3c95093c) |
| Nonlinear equations - HARD - #1 #1 | cmsjrnx6e01c5qmt18p43fejo (ba0edc30) | explanation | broken_math+explanation_truncated | ANS Hard 1 Non Linear Equations.pdf p1-p2 (ba0edc30) |
| Nonlinear equations - HARD - #1 #2 | cmsjrnx6l01c6qmt1sx4uk7ub (fc3d783a) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p3 (fc3d783a) |
| Nonlinear equations - HARD - #1 #4 | cmsjrnx6z01ccqmt15y5ex5k8 (722de804) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p6 (722de804) |
| Nonlinear equations - HARD - #1 #5 | cmsjrnx7401cdqmt114tgqxi9 (d0a53ef5) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p7 (d0a53ef5) |
| Nonlinear equations - HARD - #1 #6 | cmsjrnx7901ceqmt1f464d7i3 (2c05d312) | explanation | broken_math+artifact+explanation_truncated | ANS Hard 1 Non Linear Equations.pdf p8-p9 (2c05d312) |
| Nonlinear equations - HARD - #1 #7 | cmsjrnx7e01cfqmt1rxwc6lha (1fe32f7d) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p10 (1fe32f7d) |
| Nonlinear equations - HARD - #1 #8 | cmsjrnx7i01cgqmt13e8bf4n2 (7bd10ef3) | explanation | broken_math+explanation_truncated | ANS Hard 1 Non Linear Equations.pdf p11-p12 (7bd10ef3) |
| Nonlinear equations - HARD - #1 #9 | cmsjrnx7m01cjqmt11698qcr0 (e11294f9) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p13 (e11294f9) |
| Nonlinear equations - HARD - #1 #10 | cmsjrnx7q01ckqmt1ekxc50th (03ff48d2) | explanation | broken_math | ANS Hard 1 Non Linear Equations.pdf p14 (03ff48d2) |
| Nonlinear equations - HARD - #1 #11 | cmsjrnx7v01clqmt1y9mubnvu (17d0e87d) | explanation | broken_math+explanation_truncated | ANS Hard 1 Non Linear Equations.pdf p15-p16 (17d0e87d) |
| Nonlinear equations - MEDIUM #4 | cmsjrnxho01guqmt1kmacjlbu (2d2ab76b) | explanation | broken_math | ANS Non Linear Equations MED.pdf p3 (2d2ab76b) |
| Nonlinear equations - MEDIUM #10 | cmsjrnxia01hgqmt1r134olff (2f958af9) | explanation | broken_math | ANS Non Linear Equations MED.pdf p9 (2f958af9) |
| Nonlinear equations - MEDIUM #19 | cmsjrnxj901hxqmt1g0lj4d8h (630897df) | stem | broken_math | ANS Non Linear Equations MED.pdf p18 (630897df) |
| Nonlinear equations - MEDIUM #19 | cmsjrnxj901hxqmt1g0lj4d8h (630897df) | explanation | broken_math | ANS Non Linear Equations MED.pdf p18 (630897df) |
| Nonlinear equations - MEDIUM #23 | cmsjrnxjp01i5qmt1cyknwcly (11ccf3e1) | explanation | broken_math | ANS Non Linear Equations MED.pdf p24 (11ccf3e1) |
| Nonlinear equations - MEDIUM #29 | cmsjrnxm801ijqmt1dpfftmlv (7f81d0c3) | explanation | broken_math | ANS Non Linear Equations MED.pdf p30 (7f81d0c3) |
| Nonlinear equations - MEDIUM #30 | cmsjrnxml01ioqmt1up20zbi2 (d0a7871e) | explanation | broken_math | ANS Non Linear Equations MED.pdf p31 (d0a7871e) |
| Nonlinear functions - EASY #3 | cmsjrnxpl01lmqmt1pmalx901 (b39d74a0) | stem | flattened_table | ANS Non Linear Functions EASY.pdf p3-p4 (b39d74a0) |
| Nonlinear functions - EASY #3 | cmsjrnxpl01lmqmt1pmalx901 (b39d74a0) | explanation | wrong_explanation | ANS Non Linear Functions EASY.pdf p3-p4 (b39d74a0) |
| Nonlinear functions - EASY #12 | cmsjrnxqr01mnqmt117fncea8 (d46da42c) | explanation | wrong_explanation | ANS Non Linear Functions EASY.pdf p13-p14 (d46da42c) |
| Nonlinear functions - HARD #1 | cmsjrnx7z01cmqmt1md5ngfsx (128c75e2) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p1 (128c75e2) |
| Nonlinear functions - HARD #3 | cmsjrnx8701csqmt1xbuwdx38 (ebed7dc6) | stem | broken_math | ANS NON LINEAR FUNCT HARD .pdf p4 (ebed7dc6) |
| Nonlinear functions - HARD #3 | cmsjrnx8701csqmt1xbuwdx38 (ebed7dc6) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p4 (ebed7dc6) |
| Nonlinear functions - HARD #4 | cmsjrnx8c01ctqmt18j1s1xf6 (a9084ca4) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p6 (a9084ca4) |
| Nonlinear functions - HARD #5 | cmsjrnx8g01cyqmt135ttxd18 (b8f13a3a) | explanation | broken_math+artifact | ANS NON LINEAR FUNCT HARD .pdf p8 (b8f13a3a) |
| Nonlinear functions - HARD #6 | cmsjrnx8k01czqmt1txo80byt (9654add7) | option A | broken_math | ANS NON LINEAR FUNCT HARD .pdf p9 (9654add7) |
| Nonlinear functions - HARD #6 | cmsjrnx8k01czqmt1txo80byt (9654add7) | option C | broken_math | ANS NON LINEAR FUNCT HARD .pdf p9 (9654add7) |
| Nonlinear functions - HARD #7 | cmsjrnx8p01d4qmt1rcuyj79f (263f9937) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p11-p12 (263f9937) |
| Nonlinear functions - HARD #8 | cmsjrnx8s01d9qmt19dk1vprv (4dd4efcf) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p13-p14 (4dd4efcf) |
| Nonlinear functions - HARD #9 | cmsjrnx8w01deqmt1m59a6t6e (35e05e19) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p15 (35e05e19) |
| Nonlinear functions - HARD #10 | cmsjrnx9001dfqmt1cgom6wwm (18e35375) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p17-p18 (18e35375) |
| Nonlinear functions - HARD #11 | cmsjrnx9401dgqmt197r8t0ze (8462b105) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p19 (8462b105) |
| Nonlinear functions - HARD #12 | cmsjrnx9801dhqmt1omjdkkc6 (ce579859) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p20-p21 (ce579859) |
| Nonlinear functions - HARD #12 | cmsjrnx9801dhqmt1omjdkkc6 (ce579859) | option A | broken_math | ANS NON LINEAR FUNCT HARD .pdf p20-p21 (ce579859) |
| Nonlinear functions - HARD #12 | cmsjrnx9801dhqmt1omjdkkc6 (ce579859) | option B | broken_math | ANS NON LINEAR FUNCT HARD .pdf p20-p21 (ce579859) |
| Nonlinear functions - HARD #12 | cmsjrnx9801dhqmt1omjdkkc6 (ce579859) | option C | broken_math | ANS NON LINEAR FUNCT HARD .pdf p20-p21 (ce579859) |
| Nonlinear functions - HARD #12 | cmsjrnx9801dhqmt1omjdkkc6 (ce579859) | option D | broken_math | ANS NON LINEAR FUNCT HARD .pdf p20-p21 (ce579859) |
| Nonlinear functions - HARD #14 | cmsjrnx9h01djqmt110b0tk7s (9afe2370) | stem | broken_math | ANS NON LINEAR FUNCT HARD .pdf p24 (9afe2370) |
| Nonlinear functions - HARD #17 | cmsjrnx9u01dqqmt1py4ivoen (bba18ecb) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p30 (bba18ecb) |
| Nonlinear functions - HARD #18 | cmsjrnx9x01drqmt1k1wq1g4n (668f1863) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p31 (668f1863) |
| Nonlinear functions - HARD #19 | cmsjrnxa101dsqmt17euqje2e (70753f99) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p32 (70753f99) |
| Nonlinear functions - HARD #21 | cmsjrnxa801duqmt17wr7y809 (84dd43f8) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p34 (84dd43f8) |
| Nonlinear functions - HARD #24 | cmsjrnxaj01dxqmt1gsmlgt2r (de39858a) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p39 (de39858a) |
| Nonlinear functions - HARD #25 | cmsjrnxao01dyqmt11l4tmxq8 (1178f2df) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p41 (1178f2df) |
| Nonlinear functions - HARD #26 | cmsjrnxas01dzqmt1azee1qm6 (84e8cc72) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p43-p44 (84e8cc72) |
| Nonlinear functions - HARD #27 | cmsjrnxav01e0qmt10bitrnpm (6d9e01a2) | explanation | broken_math+artifact | ANS NON LINEAR FUNCT HARD .pdf p45 (6d9e01a2) |
| Nonlinear functions - HARD #29 | cmsjrnxb201e2qmt1dg45s9n9 (1fe10d97) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p47 (1fe10d97) |
| Nonlinear functions - HARD #30 | cmsjrnxb601e3qmt1dswrv3uu (b73ee6cf) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p48 (b73ee6cf) |
| Nonlinear functions - HARD #30 | cmsjrnxb601e3qmt1dswrv3uu (b73ee6cf) | option A | broken_math | ANS NON LINEAR FUNCT HARD .pdf p48 (b73ee6cf) |
| Nonlinear functions - HARD #30 | cmsjrnxb601e3qmt1dswrv3uu (b73ee6cf) | option B | broken_math | ANS NON LINEAR FUNCT HARD .pdf p48 (b73ee6cf) |
| Nonlinear functions - HARD #30 | cmsjrnxb601e3qmt1dswrv3uu (b73ee6cf) | option C | broken_math | ANS NON LINEAR FUNCT HARD .pdf p48 (b73ee6cf) |
| Nonlinear functions - HARD #30 | cmsjrnxb601e3qmt1dswrv3uu (b73ee6cf) | option D | broken_math | ANS NON LINEAR FUNCT HARD .pdf p48 (b73ee6cf) |
| Nonlinear functions - HARD #31 | cmsjrnxbb01e4qmt1ml439wkz (7eed640d) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p50 (7eed640d) |
| Nonlinear functions - HARD #33 | cmsjrnxbh01eaqmt1o477cqte (f25a34aa) | explanation | broken_math | ANS NON LINEAR FUNCT HARD .pdf p53 (f25a34aa) |
| Nonlinear functions - HARD #34 | cmsjrnxbl01ebqmt1id28edpg (a58232b7) | explanation | broken_math+explanation_truncated | ANS NON LINEAR FUNCT HARD .pdf p54-p55 (a58232b7) |
| Nonlinear functions - HARD #36 | cmsjrnxef01elqmt13v07uy5o (1a722d7d) | explanation | explanation_truncated+broken_math | ANS NON LINEAR FUNCT HARD .pdf p58-p59 (1a722d7d) |
| Nonlinear functions - MEDIUM #15 | cmsjrny6m01vjqmt14c1j9hek (3918e8bc) | stem | broken_math | ANS Non Linear Functions MED.pdf p16 (3918e8bc) |
| Nonlinear functions - MEDIUM #16 | cmsjrny6p01vkqmt1padmxa75 (f5e8ccf1) | explanation | broken_math | ANS Non Linear Functions MED.pdf p17 (f5e8ccf1) |
| Nonlinear functions - MEDIUM #19 | cmsjrny9p01vvqmt14dhfb8gb (dba7432e) | explanation | broken_math | ANS Non Linear Functions MED.pdf p21 (dba7432e) |
| Nonlinear functions - MEDIUM #22 | cmsjrnyat01w2qmt1iyx3aaj2 (5bf0f84a) | explanation | broken_math | ANS Non Linear Functions MED.pdf p24 (5bf0f84a) |
| Nonlinear functions - MEDIUM #25 | cmsjrnyb601wdqmt1cxia3uk9 (97158b3a) | explanation | broken_math | ANS Non Linear Functions MED.pdf p27 (97158b3a) |
| Nonlinear functions - MEDIUM #33 | cmsjrnzfw02auqmt19p2edehd (68607eca) | explanation | broken_math | ANS Non Linear Functions MED.pdf p36 (68607eca) |

## Notes on the fixes

- **broken_math** is the main defect. It has three forms:
  - Explanations imported from the ANS PDF text layer still had Unicode math-italic letters (𝑥, 𝑎, ℎ…).
  - The PDF text layer drops grouping parentheses (`𝑓𝑥` for f(x), `𝑎𝑥-ℎ2` for a(x-h)^2). These were restored from the page images, consistent with the earlier ps-adv round.
  - Stacked fractions and exponents were flattened into stray digit-run lines ("57 57 57", "7 7 7", "8 8 8 8 4 4 4", "2 2"), or image-rendered formulas were dropped entirely (EE HARD #20, NLF HARD #31, NLF HARD #36).
- **explanation_truncated**: the rationale continues on the next ANS page. The page-break tail was restored word for word. Usually this is the last "Choice X is incorrect…" line. In NEq HARD #8, NLF HARD #7/#8 and NLF HARD #36, whole paragraphs or the derivation were restored.
- **Options**: two questions had a flattened exponent `t` in all four options (NLF HARD #12 `n = 72(1.5)t`; NLF HARD #30 `60 000 = 50,000(1.03)t`, which had also lost its thousands comma). They are restored as `$…^t$` per the page image.
- **wrong_explanation**: EE EASY #5/#10/#14 had hand-written explanations, and NLF EASY #3/#12 had the stem text instead of the rationale. All five were replaced with the ANS rationale.
- **artifact**:
  - The stray trailing `#` in EE MEDIUM #3 was removed (seed).
  - Layout paragraph breaks were joined inside sentences in the EE HARD #14/#17 stems.
  - The NLF HARD #27 digit runs were removed.
- **flattened_table**: the NLF EASY #3 stem `x y / 0 0 / 1 1 …` was rebuilt as a pipe table.
- **Skipped on purpose**: Nonlinear equations MEDIUM #9 (cmsjrnxi601hbqmt1cq6h3q8u). The main session already fixed its table header, and no op touches it.
- **Seeds** (trunc-seeds.json, Advanced Math): all 8 are covered.
  - EE HARD #6
  - EE MEDIUM #3
  - NEq HARD #6
  - NLF HARD #5, #7, #8, #27 and #36

## What was checked and found clean

All 207 questions were checked for every class in the brief. The checks were run on the DB values, then re-run on the post-op values:

- Unicode math-italic, digit-run lines, stray `#`, footer, header and ID leaks (`Question Difficulty`, `Question ID`, `[tbl-`, OCR notes).
- Empty or unbalanced `$`, and KaTeX rendering of every `$…$`/`$$…$$` token (1112 tokens in the ops).
- Blank-before-punctuation gaps from stripped math.
- `A)`/`(A)` option runs in the stem, and MC questions with fewer than 4 options or empty options.
- "table" stems with no pipe table and no image.
- Explanation word coverage against the ANS rationale for the same Question ID: cut tails, text from another question, and shifts against the key. Each explanation's first line ("Choice X is correct" / "The correct answer is …") was checked against `correctAnswer`.

The remaining heuristic hits after the ops are false positives:
- numeric option values matched as digit runs;
- `that .09` / `or .275 million` read as blank-before-punctuation;
- `\(\$0\)` in NLF HARD #6 (valid inline math).

No neighbour bleed, options-in-stem, short MC or key shift was found. NLF HARD #22 (`years, t ;`) matches the source as printed, so it is clean.

## needs_review

None.
