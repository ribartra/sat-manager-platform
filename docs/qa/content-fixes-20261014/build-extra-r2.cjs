/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261014/build-extra-r2.cjs > specs/extra-r2.json
// Round 2 needs_review items resolved by the main session (see README).
const D = require(process.env.BSQ || "better-sqlite3");
const db = new D(process.argv[2] || "dev.db", { readonly: true });
const get = (table, field, id) => db.prepare(`select "${field}" v from "${table}" where id = ?`).get(id).v;
const ops = [];
// T5 Math M1 #3: option A image is a copy of B's table; the four tables now live in the option text (test-05 spec).
for (const id of ["cmsjrnude00i2qmt1ilisoxp2", "cmsjrnude00i3qmt1snhzbrti", "cmsjrnude00i4qmt1d0kxmhje", "cmsjrnude00i5qmt1uetr9pby"])
  ops.push({ table: "QuestionOption", id, field: "imageUrl", before: get("QuestionOption", "imageUrl", id), after: null,
    note: "T5 Math M1 #3: option image dropped — table now in the option text (image A wrongly showed B's table)", class: "other",
    evidence: "TEST 5 MATHS PDF p2: A=3/2,5/6,7/7,10/9; image 26f7ec2d… = B's table" });
// T5 Math M1 #22: explanation derived base angles of 50° (inconsistent with the figure) and ended with a placeholder note.
const q22 = "cmsjrnulb00jjqmt1ij3wojjk";
ops.push({ table: "Question", id: q22, field: "explanation", before: get("Question", "explanation", q22),
  after: "Correct answer: B — 60°. Points $H$, $A$, $B$ lie on a line, so $\\angle BAC=180^\\circ-100^\\circ=80^\\circ$. Triangle $ABC$ is isosceles with $AC=BC$, so $\\angle ABC=\\angle BAC=80^\\circ$ and $\\angle ACB=180^\\circ-80^\\circ-80^\\circ=20^\\circ$. Angles $FCD$ and $ACB$ are vertical angles, so $\\angle FCD=20^\\circ$. Since $CF=CD$, $\\angle CFD=\\angle CDF=\\dfrac{180^\\circ-20^\\circ}{2}=80^\\circ$. Points $G$, $F$, $E$ lie on a line, so $\\angle CFE=180^\\circ-40^\\circ=140^\\circ$ and $\\angle DFE=140^\\circ-80^\\circ=60^\\circ$. Since $FE=DE$, $\\angle FDE=\\angle DFE=60^\\circ$, so $\\angle E=180^\\circ-60^\\circ-60^\\circ=60^\\circ$.",
  note: "T5 Math M1 #22: explanation rewritten — old derivation (base angles 50°) contradicted the figure and ended with a placeholder", class: "other",
  evidence: "figure /uploads/questions/c626793c…; derivation checked by main session" });
// T6 R&W M2 #15 option A: source typo "change higher rates"; the explanation reads "charge".
const q15 = db.prepare(`select o.id from FullPracticeTestQuestion q join FullPracticeTestModule m on m.id=q.moduleId join FullPracticeTest t on t.id=m.testId join QuestionOption o on o.questionId=q.questionId where t.name='TEST 6' and m.name like 'Reading%Module 2' and q."order"=14 and o.label='A'`).get().id;
const a = get("QuestionOption", "text", q15);
if (!a.includes("change higher rates")) throw new Error("T6 M2 #15 A: unexpected text " + a);
ops.push({ table: "QuestionOption", id: q15, field: "text", before: a, after: a.replace("change higher rates", "charge higher rates"),
  note: "T6 R&W M2 #15: option A typo 'change' → 'charge' (source typo; explanation says charge)", class: "other", evidence: "test-06-findings.md needs_review" });
process.stdout.write(JSON.stringify(ops, null, 1) + "\n");
