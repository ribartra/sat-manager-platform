// Settings for the manual screenshot tools. MANUAL_WORK must point to a temporary folder OUTSIDE the
// repo: it holds a copy of the database (production data) and a git worktree; never commit it.
const path = require("path");
const REPO = path.resolve(__dirname, "../../..");
const WORK = process.env.MANUAL_WORK;
if (!WORK) throw new Error("Set MANUAL_WORK to a temporary folder outside the repo (e.g. the session scratchpad).");
module.exports = {
  REPO,
  WORK,
  DB: process.env.MANUAL_DB ?? path.join(WORK, "man.db"),
  WT: path.join(WORK, "wt"),
  IMG: path.join(REPO, "docs/manual/img"),
  BASE: process.env.MANUAL_BASE ?? "http://localhost:3001",
  PROGRAM: "program-sat-core",
  // Emulated accounts (fictional people, example.com). Same passwords as docs/manual/cuentas-demo.md.
  ACCOUNTS: {
    admin: { name: "Sofía Navarro", email: "sofia.navarro@example.com", password: "Sofia#Demo2026" },
    master: { name: "Mariana Torres", email: "mariana.torres@example.com", password: "Mariana#Demo2026" },
    teacher: { name: "Diego Ramírez", email: "diego.ramirez@example.com", password: "Diego#Demo2026" },
    lucia: { name: "Lucía Fernández", email: "lucia.fernandez@example.com", password: "Lucia#Demo2026", phone: "+51 987 654 321", birth: "2009-03-14",
      parent: { name: "Ana Fernández", email: "ana.fernandez@example.com", phone: "+51 912 345 678" } },
    mateo: { name: "Mateo Castillo", email: "mateo.castillo@example.com", password: "Mateo#Demo2026", phone: "+51 955 111 222", birth: "2008-11-02" },
    valentina: { name: "Valentina Rojas", email: "valentina.rojas@example.com", password: "Valentina#Demo2026", phone: "+51 944 333 444", birth: "2009-07-21" },
  },
  // Content removed from the copy so the AI import guide has an empty slot to fill.
  MISSING: { practiceSet: "Advanced Math - Nonlinear Functions - HARD", testNumber: 9, testSource: "src_innovator" },
};
