# PS round 2 — Problem-Solving and Data Analysis (psda) findings (2026-10-14)

Scope: `filterSets(resolveMathPracticeSets(db), {domain:"Problem-Solving and Data Analysis"})`, 22 sets / 211 questions. Read-only on dev.db. Spec: `specs/ps2-psda.json` (90 guarded ops). Checkpoint: `checkpoints/ps2-psda.jsonl` (211 lines: 89 fixed, 122 clean, 0 needs_review).

## Counts by class

| class | ops |
| --- | --- |
| stripped_math (explanation math dropped at an image gap, restored from the rendered ANS page) | 69 |
| explanation_truncated (cut tail / missing Choice paragraphs at a page break; all 8 seeds + 3 more) | 11 |
| broken_math (split superscript, `{,}` thousands inside `$…$`, unpaired currency `$`) | 4 (3 explanation + 1 stem) |
| unicode_math_italic (𝑥𝑦𝑎𝑏 + flattened stacked fractions) | 2 |
| leaked_footer (stray trailing `#`) | 1 |
| currency_dollar (literal `$` escaped as `\$`) | 1 |
| flattened_table (stem) | 1 |
| other_artifact (table-title fragments in stem) | 1 |

87 ops on `Question.explanation`, 3 on `Question.stem`, 0 on options. 89 questions touched (`cmsjro1q50383qmt19v48wzny` has a stem and an explanation op). Ops that rewrite an explanation also join hard PDF line breaks inside paragraphs (breaks before "Choice …"/"Alternate approach" paragraphs are kept) and escape literal currency in that field as `\$`.

Seeds from `trunc-seeds.json` (all resolved): `cmsjro0kc02osqmt1j6zcxh72`, `cmsjro0p702pyqmt1aqzn4l7t`, `cmsjro0tm02srqmt1ob3ask0d`, `cmsjro0xh02ttqmt1oq4nfvx6`, `cmsp3qmpz00010vmtwde2de6k`, `cmsp3qmqf00020vmta3qeyqf2`, `cmsp3qmqv00030vmtr5hbqvw1`, `cmsp5ap4n00000vmk26qmalgl`, `cmsp5ap5600010vmkwuarngfj` (tails appended from the ANS PDF, several from the next page) and `cmsjro1yv03b9qmt12ibdojp8` (stray `#` removed; the ANS rationale ends at "is 42."). Extra truncation found outside the seeds: `cmsjro0jw02ofqmt1lfzgrc83` (Choice B/D on the next page), `cmsjro1p1037mqmt1iz5u0dsh` (whole "Choice C is correct" paragraph missing).

## Fixes

| set / # | id | field | class | source |
| --- | --- | --- | --- | --- |
| Inference from Statistics and Margin of Error - EASY #1 | `cmsp3qmpz00010vmtwde2de6k` | explanation | explanation_truncated | ANS Inference Margin Error EASY.pdf p1 (Question ID 90eed2e5) |
| Inference from Statistics and Margin of Error - EASY #3 | `cmsjrnzz802f6qmt16k2zizu6` | explanation | stripped_math | ANS Inference Margin Error EASY.pdf p3 (Question ID e7d9649f) |
| Inference from Statistics and Margin of Error - EASY #4 | `cmsjrnzzc02fbqmt160c2rd9h` | explanation | stripped_math | ANS Inference Margin Error EASY.pdf p4 (Question ID f4b3672a) |
| Inference from Statistics and Margin of Error - HARD #2 | `cmsjro0ja02npqmt135b8d7bp` | explanation | stripped_math | ANS Inference Margin Error HARD.pdf p2 (Question ID 9ba3e283) |
| Inference from Statistics and Margin of Error - MEDIUM #4 | `cmsjro0gm02l1qmt1wxrz611l` | explanation | stripped_math | ANS Inference Margin Error MED.pdf p4 (Question ID f8f79e11) |
| Inference from Statistics and Margin of Error - MEDIUM #8 | `cmsjro0h502llqmt1h7bxm4zo` | explanation | stripped_math | ANS Inference Margin Error MED.pdf p8 (Question ID fc46af57) |
| One-variable data: Distributions and measures of center and spread - EASY #2 | `cmsjro0hq02lxqmt1n3f8z214` | explanation | stripped_math | ANS One Var. Data EASY.pdf p2 (Question ID 52f9a246) |
| One-variable data: Distributions and measures of center and spread - EASY #4 | `cmsjro0hw02m7qmt1uh6e4s7q` | explanation | stripped_math | ANS One Var. Data EASY.pdf p4 (Question ID c88e0663) |
| One-variable data: Distributions and measures of center and spread - EASY #6 | `cmsjro0i402mdqmt1w9w0jf5x` | explanation | stripped_math | ANS One Var. Data EASY.pdf p6 (Question ID fa7a0164) |
| One-variable data: Distributions and measures of center and spread - EASY #9 | `cmsjro0ie02msqmt1zmy6el2l` | explanation | stripped_math | ANS One Var. Data EASY.pdf p9 (Question ID c54b92a2) |
| One-variable data: Distributions and measures of center and spread - EASY #10 | `cmsjro0ih02mxqmt1d9x18rf1` | explanation | stripped_math | ANS One Var. Data EASY.pdf p11 (Question ID 66f03086) |
| One-variable data: Distributions and measures of center and spread - EASY #13 | `cmsjro0it02ncqmt1s03c89w0` | explanation | stripped_math | ANS One Var. Data EASY.pdf p14 (Question ID 869a32f1) |
| One-variable data: Distributions and measures of center and spread - EASY #14 | `cmsjro0iy02nhqmt17ee66oxv` | explanation | stripped_math | ANS One Var. Data EASY.pdf p15 (Question ID a9647302) |
| One-variable data: Distributions and measures of center and spread - HARD - #1 #1 | `cmsjro0jw02ofqmt1lfzgrc83` | explanation | explanation_truncated | Data Distribut, mean ANS HARD.pdf p1-2 (Question ID d3b9c8d8) |
| One-variable data: Distributions and measures of center and spread - HARD - #1 #2 | `cmsjro0k202olqmt1hqrsdu9b` | explanation | stripped_math | Data Distribut, mean ANS HARD.pdf p5 (Question ID 190be2fc) |
| One-variable data: Distributions and measures of center and spread - HARD - #1 #4 | `cmsjro0kc02osqmt1j6zcxh72` | explanation | explanation_truncated | Data Distribut, mean ANS HARD.pdf p10-11 (Question ID 457d2f2c) |
| One-variable data: Distributions and measures of center and spread - HARD - #1 #14 | `cmsjro0p702pyqmt1aqzn4l7t` | explanation | explanation_truncated | Data Distribut, mean ANS HARD.pdf p33-34 (Question ID 4ff597db) |
| One-variable data: Distributions and measures of center and spread - HARD - #2 #1 | `cmsjrnzyq02etqmt1pgs0y4vr` | explanation | stripped_math | ANS One Var. Data HARD.pdf p1 (Question ID 94237701) |
| One-variable data: Distributions and measures of center and spread - MEDIUM #1 | `cmsjro0tm02srqmt1ob3ask0d` | explanation | explanation_truncated | ANS One Var. Data MED.pdf p1-2 (Question ID 25fc031a) |
| One-variable data: Distributions and measures of center and spread - MEDIUM #7 | `cmsjro0wx02tdqmt1xutrmb0y` | explanation | stripped_math | ANS One Var. Data MED.pdf p8 (Question ID be00d896) |
| One-variable data: Distributions and measures of center and spread - MEDIUM #10 | `cmsjro0xd02tsqmt1qm7ef91v` | explanation | stripped_math | ANS One Var. Data MED.pdf p11 (Question ID 07f2829b) |
| One-variable data: Distributions and measures of center and spread - MEDIUM #11 | `cmsjro0xh02ttqmt1oq4nfvx6` | explanation | explanation_truncated | ANS One Var. Data MED.pdf p12-13 (Question ID 4c774b00) |
| One-variable data: Distributions and measures of center and spread - MEDIUM #13 | `cmsjro0xo02u3qmt1ju4kyqna` | explanation | stripped_math | ANS One Var. Data MED.pdf p15 (Question ID d0efc1dd) |
| Percentages - EASY #1 | `cmsjro06o02hmqmt1wa5gf115` | explanation | stripped_math | ANS Percents EASY.pdf p1 (Question ID 41b71b4e) |
| Percentages - EASY #2 | `cmsjro06t02hrqmt1khe060dp` | explanation | stripped_math | ANS Percents EASY.pdf p2 (Question ID 6e4a60dd) |
| Percentages - EASY #5 | `cmsjro07802i2qmt1xdp4uyw1` | explanation | stripped_math | ANS Percents EASY.pdf p5 (Question ID 1c2f50a6) |
| Percentages - EASY #9 | `cmsjro08002imqmt1p5uiwkyz` | explanation | stripped_math | ANS Percents EASY.pdf p9 (Question ID 7ed0d098) |
| Percentages - EASY #10 | `cmsjro08502irqmt1h5rw4u1r` | explanation | stripped_math | ANS Percents EASY.pdf p10 (Question ID 2d31caae) |
| Percentages - EASY #11 | `cmsjro08b02iwqmt1ohlrap0b` | explanation | stripped_math | ANS Percents EASY.pdf p11 (Question ID 194ae3b1) |
| Percentages - EASY #15 | `cmsjro08t02jcqmt1ti8yxehs` | explanation | stripped_math | ANS Percents EASY.pdf p15 (Question ID bd90f87e) |
| Percentages - HARD #8 | `cmsjro14302vsqmt1bgqq2e9r` | explanation | stripped_math | ANS Percents HARD.pdf p10 (Question ID 0ea56bb2) |
| Percentages - HARD #9 | `cmsjro14702vxqmt1hxid0d6i` | explanation | stripped_math | ANS Percents HARD.pdf p8 (Question ID 954943a4) |
| Percentages - HARD #10 | `cmsjro14b02vyqmt1e2z7o26z` | explanation | stripped_math | ANS Percents HARD.pdf p9 (Question ID 65c49824) |
| Percentages - MEDIUM #1 | `cmsp5ap4n00000vmk26qmalgl` | explanation | explanation_truncated | ANS Percents MED.pdf p1 (Question ID 566759ef) |
| Percentages - MEDIUM #3 | `cmsjro1up03ahqmt1uz7c50sc` | explanation | stripped_math | ANS Percents MED.pdf p3 (Question ID b2f6f17d) |
| Percentages - MEDIUM #9 | `cmsjro1y003b3qmt1mvz6gwsy` | explanation | stripped_math | ANS Percents MED.pdf p9 (Question ID 63573fea) |
| Probability and conditional probability - EASY #1 | `cmsp3qmqf00020vmta3qeyqf2` | explanation | explanation_truncated | ANS Probability EASY.pdf p1 (Question ID 1dcea480) |
| Probability and conditional probability - EASY #2 | `cmsjro23103f9qmt1uqgmjk8c` | explanation | stripped_math | ANS Probability EASY.pdf p2 (Question ID dae79de4) |
| Probability and conditional probability - EASY #3 | `cmsjro23503faqmt1ugnkskgk` | explanation | stripped_math | ANS Probability EASY.pdf p3 (Question ID 2a08d878) |
| Probability and conditional probability - EASY #4 | `cmsjro23803fbqmt12jgc4pg5` | explanation | stripped_math | ANS Probability EASY.pdf p4 (Question ID 12dbe3de) |
| Probability and conditional probability - EASY #5 | `cmsjro23b03fgqmt1z5pg5im0` | explanation | stripped_math | ANS Probability EASY.pdf p5 (Question ID ec7b0eb8) |
| Probability and conditional probability - EASY #7 | `cmsjro23h03fjqmt1njro4jcq` | explanation | stripped_math | ANS Probability EASY.pdf p7 (Question ID 60caadfd) |
| Probability and conditional probability - EASY #9 | `cmsjro23p03fpqmt1j6edxvy3` | explanation | stripped_math | ANS Probability EASY.pdf p9 (Question ID 1353b86e) |
| Probability and conditional probability - EASY #10 | `cmsjro27003fqqmt1a4ozs83u` | explanation | stripped_math | ANS Probability EASY.pdf p10 (Question ID d89c1513) |
| Probability and conditional probability - EASY #11 | `cmsjro27j03frqmt1xyznb6xj` | explanation | stripped_math | ANS Probability EASY.pdf p11 (Question ID 46545dd6) |
| Probability and conditional probability - EASY #12 | `cmsjro27t03fsqmt1tgpsl2zb` | explanation | stripped_math | ANS Probability EASY.pdf p12 (Question ID 16cea46c) |
| Probability and conditional probability - HARD #2 | `cmsjro1yv03b9qmt12ibdojp8` | explanation | leaked_footer | ANS Probability HARD.pdf p2 (Question ID 585de39a) |
| Probability and conditional probability - HARD #4 | `cmsjro1zc03bbqmt1mnrfmehp` | explanation | stripped_math | ANS Probability HARD.pdf p4 (Question ID 5dc386fb) |
| Probability and conditional probability - MEDIUM #1 | `cmsjro14u02weqmt1gl8r8mxk` | explanation | stripped_math | ANS Probability Med.pdf p1 (Question ID b1b5300b) |
| Probability and conditional probability - MEDIUM #2 | `cmsjro14x02wfqmt1r1vwtn4t` | explanation | stripped_math | ANS Probability Med.pdf p2 (Question ID e1ad3d41) |
| Probability and conditional probability - MEDIUM #5 | `cmsjro16402wiqmt13uep3edq` | explanation | stripped_math | ANS Probability Med.pdf p5 (Question ID a3384df0) |
| Probability and conditional probability - MEDIUM #7 | `cmsjro18902woqmt137q4ddu2` | explanation | stripped_math | ANS Probability Med.pdf p8 (Question ID 912cd125) |
| Probability and conditional probability - MEDIUM #9 | `cmsjro18f02wqqmt1bb3ca9ec` | explanation | stripped_math | ANS Probability Med.pdf p10 (Question ID 38a9ac45) |
| Ratios, rates, proportional relationships, and units - EASY #2 | `cmsjro2d903lcqmt1c8g3poe1` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p2 (Question ID 99550621) |
| Ratios, rates, proportional relationships, and units - EASY #4 | `cmsjro2ko03liqmt1dgcb1lxr` | explanation | broken_math | ANS Ratios Rates Propo Units EASY .pdf p4 (Question ID 3ac09984) |
| Ratios, rates, proportional relationships, and units - EASY #5 | `cmsjro2ku03lnqmt1lc7iqwtv` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p5 (Question ID 06a152cd) |
| Ratios, rates, proportional relationships, and units - EASY #8 | `cmsjro2l803m2qmt17ephq6hu` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p8 (Question ID 3f236a64) |
| Ratios, rates, proportional relationships, and units - EASY #9 | `cmsjro2lc03m7qmt1jycb4ut5` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p9 (Question ID be35c117) |
| Ratios, rates, proportional relationships, and units - EASY #10 | `cmsp3qmqv00030vmtr5hbqvw1` | explanation | explanation_truncated | ANS Ratios Rates Propo Units EASY .pdf p10 (Question ID 000259aa) |
| Ratios, rates, proportional relationships, and units - EASY #12 | `cmsjro2lg03m8qmt1p9461a0c` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p12 (Question ID ba62b0b0) |
| Ratios, rates, proportional relationships, and units - EASY #13 | `cmsjro2lm03m9qmt123e05na8` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p13 (Question ID 7cd1c6db) |
| Ratios, rates, proportional relationships, and units - EASY #14 | `cmsjro2lq03maqmt1bakr6n9u` | explanation | stripped_math | ANS Ratios Rates Propo Units EASY .pdf p14 (Question ID 24ad9dcb) |
| Ratios, rates, proportional relationships, and units - MEDIUM #2 | `cmsjro1sn039cqmt1dglodn3q` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p2 (Question ID f6cbb04a) |
| Ratios, rates, proportional relationships, and units - MEDIUM #3 | `cmsjro1ss039fqmt17w5qprgk` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p3 (Question ID 1180401d) |
| Ratios, rates, proportional relationships, and units - MEDIUM #7 | `cmsjro1tb039rqmt1uiai0zuh` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p7 (Question ID 8917ce38) |
| Ratios, rates, proportional relationships, and units - MEDIUM #9 | `cmsjro1tm039xqmt14d658ff5` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p9 (Question ID 939c46d1) |
| Ratios, rates, proportional relationships, and units - MEDIUM #10 | `cmsjro1tq03a2qmt1v7g17o7c` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p10 (Question ID 445dd032) |
| Ratios, rates, proportional relationships, and units - MEDIUM #11 | `cmsjro1tx03a3qmt1bkbgon4j` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p11 (Question ID d28c29e1) |
| Ratios, rates, proportional relationships, and units - MEDIUM #13 | `cmsjro1u703adqmt1cqywu1cg` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p13 (Question ID 8e528129) |
| Ratios, rates, proportional relationships, and units - MEDIUM #14 | `cmsjro1ub03aeqmt1d6psm1iz` | explanation | stripped_math | ANS Ratios Rates Proport. Units MED.pdf p14 (Question ID fea831fc) |
| Statistical Claims - HARD #6 | `cmsjro28l03gmqmt1b1ewujq5` | explanation | stripped_math | ANS Stat. Claims HARD.pdf p6 (Question ID 6fca0144) |
| Two-variable data: Models and scatterplots - EASY #1 | `cmsjro1oo037cqmt14nby61ls` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p1 (Question ID cf0ae57a) |
| Two-variable data: Models and scatterplots - EASY #3 | `cmsjro1p1037mqmt1iz5u0dsh` | explanation | explanation_truncated | ANS TWO Var. Data EASY.pdf p3 (Question ID 5c24c861) |
| Two-variable data: Models and scatterplots - EASY #4 | `cmsjro1pa037rqmt1qch3m3s4` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p4 (Question ID 8156d446) |
| Two-variable data: Models and scatterplots - EASY #5 | `cmsjro1pi037sqmt191vzs0rq` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p5 (Question ID d6121490) |
| Two-variable data: Models and scatterplots - EASY #6 | `cmsjro1po037xqmt1ghnxk1ot` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p6 (Question ID 9296553d) |
| Two-variable data: Models and scatterplots - EASY #7 | `cmsjro1px037yqmt11q8028sc` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p7 (Question ID a6b2fcce) |
| Two-variable data: Models and scatterplots - EASY #8 | `cmsjro1q50383qmt19v48wzny` | explanation | broken_math | ANS TWO Var. Data EASY.pdf p8 (Question ID c9dd92b1) |
| Two-variable data: Models and scatterplots - EASY #11 | `cmsjro1qu038iqmt106iz94m1` | explanation | stripped_math | ANS TWO Var. Data EASY.pdf p11 (Question ID ac5b6558) |
| Two-variable data: Models and scatterplots - HARD #4 | `cmsjro13n02vgqmt1kgz5rsr0` | explanation | stripped_math | ANS TWO Var. Data HARD.pdf p4 (Question ID 9d95e7ad) |
| Two-variable data: Models and scatterplots - HARD #5 | `cmsjro13q02vlqmt1sqt5heft` | explanation | currency_dollar | ANS TWO Var. Data HARD.pdf p5 (Question ID af142f8d) |
| Two-variable data: Models and scatterplots - HARD #7 | `cmsjro13y02vrqmt18ihfb28k` | explanation | stripped_math | ANS TWO Var. Data HARD.pdf p7 (Question ID e821a26d) |
| Two-variable data: Models and scatterplots - HARD #8 | `cmsjro0pm02q4qmt1ga5wfcw3` | explanation | stripped_math | Data Distribut, mean ANS HARD.pdf p37 (Question ID d0430601) |
| Two-variable data: Models and scatterplots - HARD #9 | `cmsjro0jz02okqmt1701ofkw4` | explanation | unicode_math_italic | Data Distribut, mean ANS HARD.pdf p4 (Question ID fb866265) |
| Two-variable data: Models and scatterplots - HARD #10 | `cmsjro0k502omqmt1mvtvw4zk` | explanation | unicode_math_italic | Data Distribut, mean ANS HARD.pdf p7 (Question ID 2e8027b0) |
| Two-variable data: Models and scatterplots - MEDIUM #4 | `cmsjro1rn038wqmt1obu1s7w3` | explanation | broken_math | ANS TWO Var. Data MED.pdf p4 (Question ID 3c5b19ef) |
| Two-variable data: Models and scatterplots - MEDIUM #7 | `cmsp5ap5600010vmkwuarngfj` | explanation | explanation_truncated | ANS TWO Var. Data MED.pdf p7 (Question ID 7ac5d686) |
| One-variable data: Distributions and measures of center and spread - HARD - #1 #10 | `cmsjro0oo02peqmt1n208ut5p` | stem | flattened_table | Data Distribut, mean ANS HARD.pdf p23 (Question ID 1142af44); also ANS One Var. Data HARD.pdf p7 |
| Two-variable data: Models and scatterplots - EASY #8 | `cmsjro1q50383qmt19v48wzny` | stem | broken_math | ANS TWO Var. Data EASY.pdf p8 (Question ID c9dd92b1) |
| Probability and conditional probability - MEDIUM #6 | `cmsjro18202wnqmt1rrn3oggr` | stem | other_artifact | ANS Probability Med.pdf p6 (Question ID b6569d0e); question image includes the title |

## needs_review

None blocking (0 checkpoint lines are needs_review). Notes for a human:
- `cmsjro0k502omqmt1mvtvw4zk` (Two-variable HARD #10): the op converts math-italic and flattened fractions to LaTeX, but keeps coordinate pairs exactly as the ANS PDF prints them, without parentheses ("0, 123.9", "12, 303.9"). The intended reading is (0, 12(3.9)) and (12, 30(3.9)). Adding parentheses would go beyond the source, so it was not done.
- Stems/options with single-`$` prices (e.g. `cmsjro06t02hrqmt1khe060dp`, `cmsjro07802i2qmt1xdp4uyw1`, `cmsjro07c02i7qmt1e2oa95fr`, `cmsjro08p02j7qmt1ddjbydsd`, `cmsp5ap4n00000vmk26qmalgl`, `cmsjro1up03ahqmt1uz7c50sc`, `cmsjro14u02weqmt1gl8r8mxk`, `cmsjro2ko03liqmt1dgcb1lxr`, `cmsjro1t2039lqmt1rv4ekgxa`, `cmsjro1u703adqmt1cqywu1cg`, `cmsjro13q02vlqmt1sqt5heft`, `cmsjro0x402tiqmt1jxnhss59`) were left unchanged. Running `tokenizeMathContent` over every stem and option produced no math token from currency and no KaTeX error, because the renderer's currency rule shows them as text. This follows the test-07 precedent. Escaping them is optional cleanup.

## What was checked and found clean

- **Explanation vs ANS rationale (all 211):**
  - A token diff found missing Choice paragraphs and cut tails. The Data Distribut, mean ANS HARD.pdf export prints stacked fractions as separate lines, and those diffs were confirmed as layout noise.
  - An image-gap detector compared the words on each side of every inline math image in the ANS rationale (pdftohtml -xml). It flagged DB text where those words sit next to each other with nothing in between.
  - The math was transcribed from the rendered page (pdftoppm -r 110) for each flagged question.
  - 113 worklist questions plus 8 extra hits were reviewed one by one. 34 of them were clean, because the math is already present as plain text, `$…$` or `\(…\)`.
- **Stems/stimulus/options (all 211):**
  - The word bag was compared with the ANS "Question" block.
  - The checks also covered:
    - options left in the stem;
    - MC questions with fewer than 4 options (none);
    - Unicode math-italic (explanations only, fixed);
    - artifacts: Question ID, footers, `[tbl-`, stray digit lines (one: `cmsjro1q50383qmt19v48wzny`, fixed);
    - 8-token runs shared with neighbouring questions that are absent from the question's own source (none that were real; the only hits were x/y math that the source text drops).
- **Tables:**
  - Every stem that mentions a table/frequency/chart either has a pipe table, a `\begin{array}` option table, or a question image that contains the table. The Probability sets' two-way tables are all images.
  - The only flattened table was `cmsjro0oo02peqmt1n208ut5p` (Value/Frequency), rebuilt as a pipe table.
  - `cmsjro18202wnqmt1rrn3oggr` kept the table title as 4 broken text fragments above an image that already shows the title; the fragments were removed.
- **Validation of `specs/ps2-psda.json`** (validate.ts):
  - every `before` equals the DB value;
  - every `after` differs from its `before`;
  - one op per (table, id, field);
  - `$` is balanced, and `\$` is excluded from the count;
  - every math token renders with KaTeX (`throwOnError`);
  - no op touches `correctAnswer`;
  - no overlap with the already-applied `specs/ps-psda.json` / `specs/ps-trunc.json`.
