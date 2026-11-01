# PS round 2 — Algebra (`alg`) findings (2026-10-14)

Scope: Math practice sets, domain **Algebra** — 15 sets, 266 questions (`filterSets(resolveMathPracticeSets(db), {domain:"Algebra"})`). Read-only on dev.db. Spec: `specs/ps2-alg.json` (59 guarded ops). Checkpoint: `checkpoints/ps2-alg.jsonl` (266 lines: 53 fixed, 213 clean, 0 needs_review).

## Counts by class

| class | ops | questions |
| --- | --- | --- |
| stripped_math | 34 | 34 |
| footer_leak | 10 | 10 |
| currency_dollar | 9 | 8 |
| ocr_artifact | 4 | 1 |
| broken_math | 3 | 2 |
| explanation_truncated | 2 | 2 |

Ops by table/field: Question.explanation 44, Question.stem 6, QuestionOption.text 9.

## Seeds (trunc-seeds.json → Algebra)

| seed | result |
| --- | --- |
| Linear eq. one variable EASY #11 `cmsjrnz8h027iqmt1102yrb2w` — stray `#` | explanation complete vs ANS p12-13; trailing ` #` removed (footer_leak) |
| Systems HARD #4 `cmsjro0q602qdqmt1ubmu4ytp` — stray `#` | explanation complete vs ANS p5-6; trailing ` #` removed (footer_leak) |
| Linear eq. one variable MEDIUM #14 `cmsp5ap9j00020vmk6srhwtyo` — ends mid-sentence | tail restored from ANS p16-17 (distribute → 11p → p = 12.5 → \$12.50) + distractor paragraph; currency escaped |

## Fixes

| set / # | id | target | class | source | note |
| --- | --- | --- | --- | --- | --- |
| Linear equations in one variable - EASY / #1 | `cmsjrnz7f026oqmt1c28riet1` | explanation | stripped_math | ANS ANS Linear Eq. One Variable EASY.pdf p2-3 (6ac23de7) | restored 4x = 100 and x = 25 |
| Linear equations in one variable - EASY / #4 | `cmsjrnz7p026zqmt1vioj8sfw` | explanation | stripped_math | ANS ANS Linear Eq. One Variable EASY.pdf p5-6 (3d04de9c) | restored 25, 20, 25-20, 5 |
| Linear equations in one variable - EASY / #11 | `cmsjrnz8h027iqmt1102yrb2w` | explanation | footer_leak | ANS ANS Linear Eq. One Variable EASY.pdf p12-13 (7a987ae4) | removed stray trailing '#' (ANS p12-13 ends at '...instead of 2n - 1.') |
| Linear equations in one variable - EASY / #16 | `cmsjrnz8t027yqmt1x5jaq93x` | explanation | stripped_math | ANS ANS Linear Eq. One Variable EASY.pdf p17-18 (e53870b6) | restored 6x, k=5, 6x+k=6x+5 |
| Linear equations in one variable - HARD / #3 | `cmsjrnz4d024vqmt126v4shyk` | explanation | broken_math | ANS ANS Linear Eq. One Variable HARD.pdf p4-5 (3f8a701b) | variable h → b in 'b ≠ 5/9' (ANS p4) |
| Linear equations in one variable - HARD / #8 | `cmsjrnz52025cqmt10ghjso56` | explanation | stripped_math | ANS ANS Linear Eq. One Variable HARD.pdf p9-10 (b7e6394d) | restored fractions 4/25, (4/25)m, 25/4; prose currency escaped as \$ |
| Linear equations in one variable - HARD / #10 | `cmsjrnz59025eqmt1mvigyjtk` | explanation | stripped_math | ANS ANS Linear Eq. One Variable HARD.pdf p11-12 (2937ef4f) | restored 4,650/5 = 930 |
| Linear equations in one variable - MEDIUM / #2 | `cmsjrnymx01z5qmt1y8nq3m50` | explanation | stripped_math | ANS ANS Linear Eq One Variable MED.pdf p4-5 (aa85b138) | restored 2n, 2(1)+6=8 |
| Linear equations in one variable - MEDIUM / #7 | `cmsjrnyni01zqqmt1wjr293nq` | explanation | stripped_math | ANS ANS Linear Eq One Variable MED.pdf p9-10 (f09097b1) | restored (1.20)(12)=14.4, 36.8-14.4=22.4, 36.8=12(1.20)+h |
| Linear equations in one variable - MEDIUM / #14 | `cmsp5ap9j00020vmk6srhwtyo` | explanation | explanation_truncated | ANS ANS Linear Eq One Variable MED.pdf p16-17 (36ab4122) | restored cut tail (ANS p16-17) and distractor paragraph; prose currency escaped as \$ |
| Linear equations in one variable - MEDIUM / #17 | `cmsjrnyoa020bqmt1lc1ac9h1` | explanation | stripped_math | ANS ANS Linear Eq One Variable MED.pdf p19-20 (8c515062) | restored all stripped numbers/fractions (17, 6, 17-6, 11, 1/4=11/h, 4h, h=44, distractor equations) |
| Linear equations in two variables - EASY / #4 | `cmsjrnyyg023dqmt10uvdzu40` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables EASY.pdf p4-5 (87322577) | restored x + y and x + y = 75 |
| Linear equations in two variables - EASY / #5 | `cmsjrnyyk023iqmt1uuzqm98a` | stem | footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p5-6 (6fa1dc0f) | removed stray trailing '\n\n#' page-footer artifact |
| Linear equations in two variables - EASY / #7 | `cmsjrnyys023oqmt1xhqxlmt7` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables EASY.pdf p7-8 (8c98c834) | restored y=0.1x, y=0.1(30), y=3 |
| Linear equations in two variables - EASY / #8 | `cmsjrnyyw023tqmt1heotosww` | option D (opt_dffeb49f44374575bbcac1262014e1eb) | footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p8-9 (b2845d88) | removed stray trailing '\n\n#' page-footer artifact [Q cmsjrnyyw023tqmt1heotosww Linear equations in two variables - EASY #8 opt D] |
| Linear equations in two variables - EASY / #9 | `cmsjrnyyz023uqmt1jhlwhadv` | stem | footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p9-10 (8adf1335) | removed stray trailing '\n\n#' page-footer artifact |
| Linear equations in two variables - EASY / #11 | `cmsjrnyz6023wqmt1nicwdbbq` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables EASY.pdf p11-12 (dd797fe2) | restored 4x, 3y, 4x+3y, /4x-3y/ |
| Linear equations in two variables - EASY / #16 | `cmsjrnyzp0245qmt1vrq35pe9` | explanation | currency_dollar | ANS ANS Linear Eq TWO Variables EASY.pdf p16-17 (dfa45424) | unescaped prose currency (\$12.50, \$1.50, \$80) paired with math delimiters and broke rendering; escaped as \$ |
| Linear equations in two variables - EASY / #16 | `cmsjrnyzp0245qmt1vrq35pe9` | stem | currency_dollar+footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p16-17 (dfa45424) | prose currency escaped as \$ (odd $ count in stem); removed stray trailing '\n\n#' page-footer artifact |
| Linear equations in two variables - EASY / #23 | `cmsjrnz0d024cqmt1kk05hyfn` | option D (opt_96489b3aff8a40c58ecf0d4b97b84282) | footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p24-25 (eeebe166) | removed stray trailing '\n\n#' page-footer artifact [Q cmsjrnz0d024cqmt1kk05hyfn Linear equations in two variables - EASY #23 opt D] |
| Linear equations in two variables - EASY / #24 | `cmsjrnz0h024dqmt1n50dbo5p` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables EASY.pdf p25-26 (b9839f9e) | restored 2.50x+7.00y, 7.00y, y=1, 7.00x1, 2.50x |
| Linear equations in two variables - EASY / #27 | `cmsjrnz0s024kqmt1sj7y0uyv` | stem | footer_leak | ANS ANS Linear Eq TWO Variables EASY.pdf p28-29 (8da536c6) | removed stray trailing '\n\n#' page-footer artifact |
| Linear equations in two variables - HARD / #9 | `cmsjrnzl202bqqmt1nwdb0a1m` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables HARD.pdf p10-11 (98d3393a) | restored line ℓ symbols and -1/2, 1/2 slopes |
| Linear equations in two variables - HARD / #9 | `cmsjrnzl202bqqmt1nwdb0a1m` | option D (opt_b67c119e31ba48aa8c9b8bf06ee0f246) | broken_math | ANS ANS Linear Eq TWO Variables HARD.pdf p10-11 (98d3393a) | line ℓ OCR'd as \mathcal{P} [Q cmsjrnzl202bqqmt1nwdb0a1m Linear equations in two variables - HARD #9 opt D] |
| Linear equations in two variables - HARD / #9 | `cmsjrnzl202bqqmt1nwdb0a1m` | stem | broken_math | ANS ANS Linear Eq TWO Variables HARD.pdf p10-11 (98d3393a) | line ℓ OCR'd as \mathcal{P}; source prints script ℓ |
| Linear equations in two variables - HARD / #11 | `cmsjrnzlb02buqmt14xwwo7l3` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables HARD.pdf p12-13 (c362c210) | restored point (16, 0); prose currency escaped |
| Linear equations in two variables - MEDIUM / #2 | `cmsjrnyhu01xnqmt1dkf5z42i` | explanation | currency_dollar | ANS ANS Linear Eq TWO Variables MED.pdf p3-4 (1087f6c4) | unescaped prose currency (\$641, \$24.50, \$24.75) paired with math delimiters and broke rendering; escaped as \$ |
| Linear equations in two variables - MEDIUM / #21 | `cmsjrnyk101ymqmt137ykwbgt` | explanation | stripped_math | ANS ANS Linear Eq TWO Variables MED.pdf p22-23 (038d87d7) | restored 2, 35, 3,934, 2x+35y=3,934, 2x, 35y, x |
| Linear functions - EASY / #0 | `cmsjrnz920284qmt1vkp5o4q7` | explanation | stripped_math | ANS ANS Linear Functions EASY.pdf p1-2 (84664a7c) | restored h = 8s + 15 |
| Linear functions - EASY / #7 | `cmsjrnzca028nqmt1n51zk9nf` | explanation | stripped_math | ANS ANS Linear Functions EASY.pdf p8-9 (a396ed75) | restored 5.7, x, 5.7x, m(x)=5.7x |
| Linear functions - EASY / #10 | `cmsjrnzct028yqmt1idhnfbz2` | explanation | currency_dollar | ANS ANS Linear Functions EASY.pdf p11-12 (255996a6) | unescaped prose currency \$1,576 paired with the next math $ and broke rendering; escaped as \$ |
| Linear functions - EASY / #22 | `cmsjrnze9029uqmt1lvqmwse9` | option A (opt_8e83848c-4fe6-4110-81fb-81f9bb874fa2) | ocr_artifact | ANS ANS Linear Functions EASY.pdf p24-25-26 (a8e6bd75) | image-only option: OCR markdown placeholder '![img-N.jpeg](img-N.jpeg)' removed (imageUrl already set; other image options store text '') [Q cmsjrnze9029uqmt1lvqmwse9 Linear functions - EASY #22 opt A] |
| Linear functions - EASY / #22 | `cmsjrnze9029uqmt1lvqmwse9` | option B (opt_cd4e1d9e-954c-442d-a61f-70629fd4c645) | ocr_artifact | ANS ANS Linear Functions EASY.pdf p24-25-26 (a8e6bd75) | image-only option: OCR markdown placeholder '![img-N.jpeg](img-N.jpeg)' removed (imageUrl already set; other image options store text '') [Q cmsjrnze9029uqmt1lvqmwse9 Linear functions - EASY #22 opt B] |
| Linear functions - EASY / #22 | `cmsjrnze9029uqmt1lvqmwse9` | option C (opt_f101cab3-c01d-4f12-b17d-2b215de6cad9) | ocr_artifact | ANS ANS Linear Functions EASY.pdf p24-25-26 (a8e6bd75) | image-only option: OCR markdown placeholder '![img-N.jpeg](img-N.jpeg)' removed (imageUrl already set; other image options store text '') [Q cmsjrnze9029uqmt1lvqmwse9 Linear functions - EASY #22 opt C] |
| Linear functions - EASY / #22 | `cmsjrnze9029uqmt1lvqmwse9` | option D (opt_d818c705-58cf-469b-abd5-66ee86f8533b) | ocr_artifact | ANS ANS Linear Functions EASY.pdf p24-25-26 (a8e6bd75) | image-only option: OCR markdown placeholder '![img-N.jpeg](img-N.jpeg)' removed (imageUrl already set; other image options store text '') [Q cmsjrnze9029uqmt1lvqmwse9 Linear functions - EASY #22 opt D] |
| Linear functions - HARD / #6 | `cmsjrnzev02abqmt1gr044lw3` | explanation | stripped_math | ANS ANS Linear Funct HARD.pdf p7-8 (6989c80a) | restored F(x)=9/5(x-273.15)+32, x, 2.10, 9/5(2.10), 3.78 |
| Linear functions - HARD / #13 | `cmsjrnzfk02amqmt1v8tdlxz2` | explanation | stripped_math | ANS ANS Linear Funct HARD.pdf p14-15 (b3abf40f) | restored F(x)=9/5(x-273.15)+32, x, 9.10, 9/5(9.10), 16.38 |
| Linear functions - HARD / #14 | `cmsjrnzfn02anqmt1udae05zd` | explanation | currency_dollar | ANS ANS Linear Funct HARD.pdf p15-16 (be9cb6a2) | unescaped prose currency ($270, $135) paired with math delimiters and broke rendering; escaped as \$ |
| Linear functions - MEDIUM / #8 | `cmsjrnyw4022dqmt131cgy8jl` | option D (opt_362b6dfb600e4a7a8365172dc12b005d) | footer_leak | ANS ANS Linear Funct MED.pdf p10-11 (271f7e3f) | removed stray trailing '\n\n#' page-footer artifact [Q cmsjrnyw4022dqmt131cgy8jl Linear functions - MEDIUM #8 opt D] |
| Linear functions - MEDIUM / #10 | `cmsjrnywf022lqmt1i8km6hpv` | option D (opt_48d85bf07d7548b5b8a7536589e2a1e6) | footer_leak | ANS ANS Linear Funct MED.pdf p12-13 (c22b5f25) | removed stray trailing '\n\n#' page-footer artifact [Q cmsjrnywf022lqmt1i8km6hpv Linear functions - MEDIUM #10 opt D] |
| Linear functions - MEDIUM / #14 | `cmsjrnyx1022pqmt145bp8w1d` | stem | stripped_math | ANS ANS Linear Funct MED.pdf p16-17-18 (f0773a55) | restored variable x in 'for x hours of work' (ANS p16 question) |
| Linear functions - MEDIUM / #15 | `cmsjrnyx7022uqmt1gkvkpedj` | explanation | stripped_math | ANS ANS Linear Funct MED.pdf p18-19 (113b938e) | restored point (x, y) |
| Linear functions - MEDIUM / #21 | `cmsjrnyxz0234qmt16q0dxub9` | explanation | currency_dollar | ANS ANS Linear Funct MED.pdf p24-25 (4fe4fd7c) | unescaped prose currency \$800 paired with math delimiters and broke rendering; escaped as \$ |
| Linear inequalities in one or two variables - EASY / #2 | `cmsjrnyfz01x0qmt11v6epal0` | explanation | stripped_math | ANS ANS Linear Inequalities EASY.pdf p3-4 (f01ef454) | restored 12.7, 15.7, 165, 165(12.7), 165(15.7), x and the inequality |
| Linear inequalities in one or two variables - EASY / #5 | `cmsjrnyga01x3qmt11rv16djp` | explanation | stripped_math | ANS ANS Linear Inequalities EASY.pdf p6-7 (84d0d07e) | restored 15s, 25p, 15s+25p, 15s+25p ≤ 120; prose currency escaped as \$ |
| Linear inequalities in one or two variables - EASY / #9 | `cmsjrnyh901xbqmt11p3gn17i` | explanation | stripped_math | ANS ANS Linear Inequalities EASY.pdf p10-11 (563407e5) | restored 200 ≤ 205 ≤ 240 |
| Linear inequalities in one or two variables - HARD / #2 | `cmsjrnzg902b2qmt1fkbvt19a` | explanation | currency_dollar | ANS ANS Linear Inequalities HARD.pdf p3-4 (68c5c81a) | unescaped prose currency \$115 paired with math delimiters and broke rendering; escaped as \$ |
| Linear inequalities in one or two variables - HARD / #5 | `cmsjrnzgl02b9qmt1hd5h3q4l` | explanation | stripped_math | ANS ANS Linear Inequalities HARD.pdf p6-7 (55ea82f3) | restored 140, 220, \$5,820, \$3, x, x+3, 140(x+3), 220x and the inequality |
| Linear inequalities in one or two variables - MEDIUM / #8 | `cmsjrnyp7020sqmt1ukw7csc9` | explanation | stripped_math | ANS ANS Linear Inequalities MED.pdf p9-10 (6daf8d70) | restored a, b, 164 and all inequalities (a+b ≤ 164, a ≤ 3b, a+b ≥ 164, 3a ≥ b) |
| Linear inequalities in one or two variables - MEDIUM / #10 | `cmsjrnype020uqmt180342x45` | explanation | stripped_math | ANS ANS Linear Inequalities MED.pdf p11-12 (90bd9ef8) | restored (4,334-2,712), (4,334-2,712)t, 25,000 < (4,334-2,712)t, ratio 4,332/2,712 (source quirk kept); prose currency escaped |
| Linear inequalities in one or two variables - MEDIUM / #11 | `cmsjrnyph020vqmt1u20rbmd0` | explanation | stripped_math | ANS ANS Linear Inequalities MED.pdf p12-13 (e9ef0e6b) | restored 72, 77, 16, 72(16), 77(16), x and the inequality |
| Systems of two linear equations in two variables - EASY / #4 | `cmsjrnz5s025sqmt17va91f53` | explanation | currency_dollar+stripped_math | ANS ANS Systems 2 Lin Equat 2 Var EASY.pdf p5-6 (0df106df) | prose currency escaped as \$ (it was pairing with math and breaking rendering); system shown as display; remaining plain-text math kept as in DB |
| Systems of two linear equations in two variables - EASY / #11 | `cmsjrnz6g026bqmt189lkgblx` | explanation | stripped_math | ANS ANS Systems 2 Lin Equat 2 Var EASY.pdf p12-13 (dba8d38a) | restored s+p=250, 5s, 12p, 5s+12p=2,300; prose currency escaped as \$ |
| Systems of two linear equations in two variables - HARD / #4 | `cmsjro0q602qdqmt1ubmu4ytp` | explanation | footer_leak | ANS ANS Systems Two Lin Eq. Two Var HARD.pdf p5-6 (e1248a5c) | removed stray trailing '#' (ANS p5-6 ends at '...has one solution.') |
| Systems of two linear equations in two variables - HARD / #6 | `cmsjro0qd02qiqmt14myik8ok` | explanation | stripped_math+currency_dollar | ANS ANS Systems Two Lin Eq. Two Var HARD.pdf p7-8 (d7bf55e1) | restored the elimination display (12a+8c=300 / -8a-8c=-240 / 4a+0c=60) that the ANS prints as an image after 'second equation:'; prose currency escaped as \$ (the unescaped $ paired into a broken math token '$8) = $') |
| Systems of two linear equations in two variables - HARD / #9 | `cmsjro0ql02qlqmt1j468h4ba` | explanation | stripped_math | ANS ANS Systems Two Lin Eq. Two Var HARD.pdf p10-11 (e2e3942f) | restored y = mx + b, 1, -8 |
| Systems of two linear equations in two variables - HARD / #13 | `cmsjro0qy02qwqmt146agqa79` | explanation | stripped_math | ANS ANS Systems Two Lin Eq. Two Var HARD.pdf p14-15 (567ac7ab) | restored 6x-2y=0, -6, -3, 6x+2y=10 |
| Systems of two linear equations in two variables - MEDIUM / #2 | `cmsjrnypx0213qmt1wvpd8dbq` | explanation | explanation_truncated | ANS ANS Systems 2 Lin Equat 2 Var MED.pdf p3-4-5 (2704399f) | appended missing distractor paragraph from ANS p4 (page break) |
| Systems of two linear equations in two variables - MEDIUM / #14 | `cmsjro0r102qxqmt13jpgi87c` | explanation | stripped_math | ANS ANS Systems 2 Lin Equat 2 Var MED.pdf p17-18 (cb8f449f) | restored x = 6 (twice) and the shown elimination work |

## needs_review

None. Every hit was resolvable from the ANS PDF (text layer + 110-dpi page renders for image-only math).

## What was checked (all 266 questions) and found clean

- **Explanation completeness (class 5):** every `Question.explanation` aligned word-by-word (difflib) with the ANS rationale for the same Question ID (pdftotext -layout, rationale spanning page breaks). Only 2 real cuts (MED #14 Megan, Systems MED #2 missing distractor paragraph on the next page) + 2 stray `#`. No leaked "Question Difficulty"/page numbers/header dumps, no foreign-question text, no explanation shifted against the key (all MC keys equal the ANS "Correct Answer").
- **Stripped math (class 4):** ANS image-math leaves ≥3-space gaps (or a line starting with punctuation) in the text layer; each gap was mapped to the DB text between the same two words. 32 ops restore math that the ingest dropped (values read from page renders, `$…$`); display blocks lost without a text gap were searched via lead-ins (`:` + new sentence, "as shown", "below must hold") → Systems HARD #6 and MED #14 elimination work restored. The ~20 "the  xy-plane" gaps are typography (italic x/y), DB already has the letters — clean. No Unicode math-italic letters, no empty `$$`, no flattened-fraction digit runs.
- **Broken math:** `\mathcal{P}` OCR'd for script ℓ (2-var HARD #9 stem + option D) → `\ell`; `h ≠ 5/9` → `b ≠ 5/9` (1-var HARD #3).
- **Currency:** unescaped prose `$` that pairs with a math delimiter (renderer-faithful tokenizer, `lib/math-text.ts` rules) and produces a broken token (`$ and $`, `$ to give $`, `$8) = $`, `$ $`) → escaped as `\$` in 8 explanations + 1 stem; every field touched by an op has all prose currency escaped. Other fields with unescaped prose currency still render correctly (the `$…$` prose-body heuristic keeps them literal) and were left as-is per "if it already renders like the source, it is clean".
- **Artifacts (class 6):** 8 stray `\n\n#` page-footer tails (4 stems, 4 options) removed; Linear functions EASY #22 image-only options carried OCR markdown `![img-N.jpeg](img-N.jpeg)` as text (rendered literally; only 4 such options in the whole DB) → text `""` like the other 28 image options (image for key D verified = y = 2x − 5). No `[tbl-…]`, OCR notes or UI text.
- **Stems/options vs source (classes 1, 2, 6):** stem+stimulus and option words compared with the ANS "Question"/"Answer" blocks: no truncated lead-ins, no paraphrased/shortened options, no options left in stems, every MC has 4 options. Remaining word diffs are LaTeX names or table/graph titles present as images in the source.
- **Neighbour bleed (class 1):** 8-token shingles shared between consecutive questions of each set are only boilerplate ("Choice D is incorrect and may result from…", "y = mx + b where m is the slope") or genuinely parallel SAT items; no Question ID markers or next-number leaks.
- **Tables (class 3):** every "table" stem/explanation has a KaTeX `array`, the table is in the question image, or the table lives in the options (arrays). No flattened `label = value` series.
- **Validation:** `before` == live dev.db value for all ops, `after ≠ before`, one op per (table,id,field), balanced `$` (escaped `\$` excluded), every math token renders with KaTeX `throwOnError`, no op touches `correctAnswer`.

Already-applied earlier fixes (`specs/ps-alg.json`, `specs/ps-trunc.json`, `docs/qa/practice/specs/*`) are reflected in the current DB values and were not re-touched.
