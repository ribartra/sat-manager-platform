/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261014/build-extra-r3.cjs > specs/extra-r3.json
// Round 3 needs_review items resolved by the main session: TEST 9 Math M1 #21/#22 explanations (written from the graphs).
const D = require(process.env.BSQ || "better-sqlite3");
const db = new D(process.argv[2] || "dev.db", { readonly: true });
const expl = (id) => db.prepare("select explanation v from Question where id = ?").get(id).v;
const q21 = "cmsjrnw88011bqmt1xskeplzv", q22 = "cmsjrnw8l011dqmt1owbpkau5";
const ops = [
  { table: "Question", id: q21, field: "explanation", before: expl(q21),
    after: "Choice C is correct. If $(x-k)$ is a factor of $f(x)$, then $f(k)=0$, so the graph of $y=f(x)$ meets the $x$-axis at $x=k$. The graph crosses the $x$-axis at $x=-5$ and $x=-1$. Since $f(-1)=0$, $x-(-1)$, or $(x+1)$, must be a factor of $f(x)$.\nChoice A is incorrect. $(x-5)$ would require $f(5)=0$, but the graph is above the $x$-axis at $x=5$.\nChoice B is incorrect. $(x-4)$ would require $f(4)=0$, but at $x=4$ the graph is above the $x$-axis and doesn't touch it.\nChoice D is incorrect. $(x+2)$ would require $f(-2)=0$, but the graph is below the $x$-axis at $x=-2$.",
    note: "T9 Math M1 #21: explanation argued for D (x+2) while the key is C; rewritten for C from the graph (zeros at -5 and -1)", class: "other",
    evidence: "graph /uploads/questions/b6b1e564…; key C = Ans Key docx; docx explanation itself wrong" },
  { table: "Question", id: q22, field: "explanation", before: expl(q22),
    after: "Choice D is correct. The line shown is the graph of $y=g(x)-5$. It passes through the points $(-6,-2)$ and $(0,3)$, so its slope is $\\frac{3-(-2)}{0-(-6)}=\\frac{5}{6}$ and its $y$-intercept is $3$. So $g(x)-5=\\frac{5}{6}x+3$. Adding $5$ to both sides gives $g(x)=\\frac{5}{6}x+8$.\nChoice A is incorrect. It has the wrong $y$-intercept: $g(0)=3+5=8$, not $-5$.\nChoice B is incorrect. This is the result of subtracting $5$ from the line's equation instead of adding $5$.\nChoice C is incorrect. This is the equation of the line shown, $y=g(x)-5$, not of $g(x)$.",
    note: "T9 Math M1 #22: explanation was missing; written from the graph (docx text had a wrong point (0, -2))", class: "other",
    evidence: "graph /uploads/questions/41ed2994… passes (-6,-2) and (0,3); key D" },
];
for (const o of ops) if (o.before === o.after) throw new Error("no change " + o.id);
process.stdout.write(JSON.stringify(ops, null, 1) + "\n");
