# PS round 2 — full content brief for practice sets (2026-10-14)

Same criteria as the FPT rounds (see test-0N-findings.md), applied to practice sets. Read-only on dev.db.

**Inputs:**
- Open `dev.db` read-only with better-sqlite3 (`require(process.cwd()+"/node_modules/better-sqlite3")`, `{readonly:true}`). There is no sqlite3 CLI.
- Resolve the sets with `scripts/qa/practice-common.mjs`: `resolveMathPracticeSets`, `resolveReadingPracticeSets`, `resolveWritingPracticeSets` and `filterSets`. They return:
  - the questions in order, each with its options, `candId` and `pageArtifactId`;
  - the exercise PDF and the ANS PDF.
- **Sources:**
  - `IngestQuestionCandidate` (stem/stimulus/optionsJson/explanation/rawJson);
  - `IngestPageArtifact.extractedText`;
  - the PDF/docx under `files_to_load/`. DB paths that start with `/app/` map to the repo root.
  - `pdftotext -layout -f N -l N`, or `pdftoppm -r 110 -f N -l N -png` to look at a page.
  - The ANS PDF prints "Question ID <hex>" (sometimes without the colon).

**Per question, check:**
1. **Neighbour bleed or concatenation.** Text of question N+1 or N−1 inside N: a shared run of 8 or more tokens, the next number or a "Question ID" marker, a passage appended or replaced, a passage missing its first sentence.
2. **Options left in the stem or stimulus.** `× A`, `A)`/`(A)` sequences, a line equal to an option, option text repeated at the end of the stem. Also MC questions with fewer than 4 options.
3. **Flattened tables.** "The table shows …" with `label = value` series and no pipe table and no image. Rebuild them as a GitHub pipe table: a header row, then `| --- |`, then the rows. Use the source column headers.
4. **Stripped or broken math** in the stem, options or explanation: "If , then", empty `$$`, dangling operators, Unicode math-italic letters (𝑎𝑏𝑘), stacked fractions flattened into "57 57 57"-like digit runs.
5. **Explanation completeness.** Compare `Question.explanation` with the ANS rationale for the same Question ID: a cut tail (page break), a leaked footer ("Question Difficulty:", page numbers, stray `#`), a header dump, text from another question, an explanation shifted by one against the key (check by meaning).
6. **Other artifacts.** UI text, `[tbl-…]`, OCR notes, truncated lead-ins, options shortened or paraphrased against the source (compare word for word).

**Rules:**
- The source decides.
- Never change `correctAnswer`.
- Don't invent content. If the source is ambiguous, mark the item `needs_review` and produce no op.
- Keep the source wording, quirks included.
- Math is written as `$…$` inline, or `$$…$$` on its own line. A literal dollar in prose is `\$`.
- Every `$` must be balanced, and every expression must render with KaTeX (`throwOnError`). katex is in node_modules.
- Leave fixes that are already applied alone: specs/ps-*.json, docs/qa/practice/specs/*. If the DB already matches the source, the question is clean.

**Checkpoint (mandatory):**
- Append one JSON line per finished question to `docs/qa/content-fixes-20261014/checkpoints/ps2-<area>.jsonl`:
  `{"id","set","order","status":"clean|fixed|needs_review","ops":[…],"evidence"}`.
- Before starting, read the file and skip ids that are already in it, so a restart resumes where it left off.
- The checks are cheap and deterministic: run them across all the questions in your area and checkpoint every one. For each hit, compare with the source.

**Output:**
- `docs/qa/content-fixes-20261014/specs/ps2-<area>.json`: an array of guarded ops `{"table":"Question"|"QuestionOption","id","field":"stem"|"stimulus"|"explanation"|"text","before","after","class","note","evidence"}`.
  - `before` is the EXACT current value; for options, use the `QuestionOption.id`.
  - Only one op per (table, id, field). Merge several fixes to the same field into one op.
- `docs/qa/content-fixes-20261014/ps2-<area>-findings.md`: counts by class, a table of the fixes (set/#, id, class, source page), the needs_review list, and what was checked and found clean.
- Do NOT write to dev.db or to any other repo file. Put scratch scripts in `/tmp/claude-1000/-home-turista-Descargas-Github-sat-manager-platform/799ef8a8-ccdc-4ecc-8ced-445dfbc97cc0/scratchpad/ps2/<area>/`.
- Validate the spec before finishing:
  - every `before` equals the DB value;
  - `after !== before`;
  - balanced `$`;
  - KaTeX renders;
  - no op touches `correctAnswer`.
