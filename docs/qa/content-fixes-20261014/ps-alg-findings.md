# PS Algebra — stripped-math explanations (2026-10-14)

Scope: 22 heuristic candidates from `psx/alg.json`. Read-only on dev.db; ops in `specs/ps-alg.json` (21 guarded ops, class `stripped_math`), built from `checkpoints/ps-alg.jsonl`.

**Result: 21 fixed / 0 false positive / 1 needs_review.**

Sources: 4 ingest candidates (Linear equations in two variables EASY #2, #11, #14, #22) carry an `explanation` with LaTeX. Its prose matches the DB, so its expressions were used. Bare numbers that the DB had also lost (for example "values of : , , and ." → `$0$`, `$1$`, `$2$`) were wrapped as math, and "`$x = 0, y = 21$`" was split into `$x = 0$`, `$y = 21$` because the comma is prose in the DB. Every explanation, including those 4, was checked against the rendered ANS PDF page (`pdftoppm -r 110`; 200 dpi for LF HARD #16). The other 18 were transcribed from the page image, since the candidate text and the page artifacts lack the math.

Checks on each op: `before` is re-read from dev.db at build time and is the exact value. `after` with `$…$` removed and whitespace collapsed equals `before`; a hard break after a hyphen ("y-\nintercept", "xy-\nplane") was joined without a space, which is the only whitespace difference. The dollar signs are balanced, and all 367 expressions render with KaTeX (`throwOnError`). `lib/math-text` `tokenizeMathContent` yields exactly the same math tokens, with no stray `$` in prose. Each conclusion matches `correctAnswer`. Paragraphs follow the source: one per "Choice …"/"Choices …"/"Alternate approach" paragraph. Where the source runs several wrong-choice explanations together in one paragraph (for example Linear equations in one variable MEDIUM #16, Linear inequalities MEDIUM #10), they stay in one paragraph.

| Set / # | Question id | ANS PDF page (Question ID) | Status | Restored | Key |
|---|---|---|---|---|---|
| Linear equations in one variable - EASY #15 | cmsjrnz8q027xqmt1r7q5jztz | ANS Linear Eq. One Variable EASY p15 (4f7981a0) | fixed | restored 3(3x+2)=24, 9x+6=24 | 24 ✓ |
| Linear equations in one variable - MEDIUM #16 | cmsjrnyo40205qmt1njo0htjg | ANS Linear Eq One Variable MED p17 (5ad9eff0) | fixed | restored w+6, perimeter sum = 4w+12 | B ✓ |
| Linear equations in one variable - MEDIUM #6 | cmsjrnyna01zgqmt1owydghx4 | ANS Linear Eq One Variable MED p7 (018a2704) | fixed | restored 16, 30=2(x-8), 2(x-8), 30 | C ✓ |
| Linear equations in two variables - EASY #11 | cmsjrnyz2023vqmt1hfxur4ls | ANS Linear Eq TWO Variables EASY p10 (e7343559) | fixed | restored x-values 0,1,2, y=-4x+40 substitutions, 40/36/32, choice equations | C ✓ |
| Linear equations in two variables - EASY #14 | cmsjrnyzc0242qmt1i4701xav | ANS Linear Eq TWO Variables EASY p13 (cea27ab2) | fixed | restored x/y table values and 7x-4y=-84 substitutions per choice | A ✓ |
| Linear equations in two variables - EASY #2 | cmsjrnyy50236qmt1v9z1mkq0 | ANS Linear Eq TWO Variables EASY p1 (83f2c3bf) | fixed | restored y=x+4 substitutions 0/1/2 -> 4/5/6, choice equations | A ✓ |
| Linear equations in two variables - EASY #22 | cmsjrnz06024aqmt1t311rf6s | ANS Linear Eq TWO Variables EASY p22 (1efd8202) | fixed | restored y=70x+8 substitutions 0/2/4 -> 8/148/288, choice B equation | A ✓ |
| Linear equations in two variables - HARD #1 | cmsjrnzgy02bdqmt1rgy2w8oa | ANS Linear Eq TWO Variables HARD p1 (49800634) | fixed | restored y=mx+b, slope formula, points (-18,-48),(7,52), m=4, b=24, y=4x+24, a=172/7 | D ✓ |
| Linear equations in two variables - MEDIUM #26 | cmsjrnymm01yuqmt1k6h2o9n3 | ANS Linear Eq TWO Variables MED p26 (00b9bd37) | fixed | restored y=mx+b, points (0,35),(90,0), m=-7/18, 7x+18y=630, choice checks | B ✓ |
| Linear functions - EASY #13 | cmsjrnzd20294qmt1jtmya7vo | ANS Linear Functions EASY p13 (de6fe450) | needs_review | see note below | C ✓ |
| Linear functions - EASY #19 | cmsjrnzdm029iqmt14vy8g7wy | ANS Linear Functions EASY p20 (8643d906) | fixed | restored P(t), P(30)=550, t=30, P(t)=550 | C ✓ |
| Linear functions - EASY #3 | cmsjrnz980286qmt1rkl8gmbu | ANS Linear Functions EASY p3 (06fc1726) | fixed | restored f(x)=(2x-1)/3 and f(5) evaluation chain = 3 | C ✓ |
| Linear functions - HARD #16 | cmsjrnzfq02aoqmt1puhjz0l1 | ANS Linear Funct HARD p16 (e25f0807) | fixed | restored 65/4, y=mx+b, table points (-12,-45),(6,45), system solving m=5, b=15, y=5x+15, a=65/4 | 16.25|65/4 ✓ |
| Linear functions - MEDIUM #12 | cmsjrnywj022mqmt1uw8ndtuz | ANS Linear Funct MED p13 (11e1ab81) | fixed | restored d=km, (m, d), (2, 4), 4=k(2), k=2, d=2m | A ✓ |
| Linear inequalities in one or two variables - EASY #1 | cmsjrnyfq01wuqmt1u9vk6sw5 | ANS Linear Inequalities EASY p1 (b75f7812) | fixed | restored 60h+10≤280, h≤4.5 | 4 ✓ |
| Linear inequalities in one or two variables - EASY #9 | cmsjrnyh501xaqmt160yp3iwt | ANS Linear Inequalities EASY p9 (df32b09c) | fixed | restored (G+85+78+98)/4 and ≥90 inequality | C ✓ |
| Linear inequalities in one or two variables - MEDIUM #1 | cmsjrnyod020cqmt1oc8tvc2z | ANS Linear Inequalities MED p1 (f224df07) | fixed | restored 120a+100b≤1,100, a+b≥10, b≥10-a, substitution chain to a≤5 | C ✓ |
| Linear inequalities in one or two variables - MEDIUM #10 | cmsjrnypa020tqmt107mu6ebc | ANS Linear Inequalities MED p10 (948087f2) | fixed | restored x>y+1, 2>-1+1, (2, -1), substitution checks for D and A/B/C | D ✓ |
| Systems of two linear equations in two variables - EASY #14 | cmsjrnz6n026hqmt1hjhcecl7 | ANS Systems 2 Lin Equat 2 Var EASY p14 (e1259a5a) | fixed | restored x=3, y=9, (3, 9) | A ✓ |
| Systems of two linear equations in two variables - EASY #2 | cmsjrnz5i025pqmt1qy19ww4x | ANS Systems 2 Lin Equat 2 Var EASY p2 (44d65912) | fixed | restored 20c+10s=700, 25c+12s=850 | B ✓ |
| Systems of two linear equations in two variables - HARD #11 | cmsjro0qo02qpqmt13a4exyes | ANS Systems Two Lin Eq. Two Var HARD p11 (1e0a46e4) | fixed | restored -2x+3y=9, 2, -4x+6y=18, 4x-6y=18, 0=36 | D ✓ |
| Systems of two linear equations in two variables - MEDIUM #3 | cmsjrnypx0213qmt1wvpd8dbq | ANS Systems 2 Lin Equat 2 Var MED p3 (2704399f) | fixed | restored (3/2, 0), y=0, x=3/2, 3/2 | A ✓ |

## needs_review — Linear functions EASY #13 (cmsjrnzd20294qmt1jtmya7vo)

The math is clear in the source (ANS Linear Functions EASY p13, de6fe450): `0.50x`, `9.25+0.50x`, `f(x)=9.25+0.50x` (key C ✓). The same paragraph also has prose currency ("increase by $0.50", "was $9.25"), which per the rules stays as plain text. With inline `$…$` math on the same line, `MATH_TOKEN_PATTERN` pairs the prose `$` with the math `$` ("$0.50 on the first day … represented by $"). That span is classified as prose, and the math renders as literal text with stray dollar signs. The renderer has no prose escape for `$`, so a renderable fix needs either a prose change (for example the currency inside math as `$\$0.50$`) or renderer support for `\$` in prose. That is a product decision, so no op was emitted. Proposed text, correct but not renderable as is:

```
Choice C is correct. It’s given that the city’s minimum hourly wage will increase by $0.50 on the first day of the year for the 5 years after January 1, 2015. Therefore, the total increase, in dollars, in the minimum hourly wage x years after January 1, 2015, is represented by $0.50x$. Since the minimum hourly wage on January 1, 2015, was $9.25, it follows that the minimum hourly wage, in dollars, x years after January 1, 2015, is represented by $9.25+0.50x$. Therefore, the function $f(x)=9.25+0.50x$ best models this situation.
Choices A, B, and D are incorrect. In choice A, the function models a situation where the minimum hourly wage is $9.25 on January 1, 2015, but decreases by $0.50 on the first day of the year for the next 5 years. The functions in choices B and D both model a situation where the minimum hourly wage is increasing by $9.25 on the first day of the year for the 5 years after January 1, 2015.
```
