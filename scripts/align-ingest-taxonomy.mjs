import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL.replace(/^file:/, "")
  : "dev.db";

function normalizeKey(value) {
  const replacements = {
    equiv: "equivalent",
    equival: "equivalent",
    expres: "expression",
    express: "expression",
    eq: "equations",
    funct: "functions",
    lin: "linear",
    var: "variable",
    vars: "variables",
    trig: "trigonometry",
    propo: "proportions",
    proport: "proportions",
    percents: "percentages",
    percent: "percentages",
    statis: "statistical",
    stat: "statistical",
    grammar: "grammar",
    sn: "student notes",
    ce: "command evidence",
  };
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => replacements[token] ?? token)
    .join(" ");
}

const mathDomains = new Map([
  ["advanced math", "Advanced Math"],
  ["algebra", "Algebra"],
  ["geometry and trigonometry", "Geometry and Trigonometry"],
  ["problem solving data analysis", "Problem Solving and Data Analysis"],
]);

const skills = new Map([
  ["equivalent expression", "Equivalent Expressions"],
  ["equivalent expressions", "Equivalent Expressions"],
  ["non linear equations", "Nonlinear Equations"],
  ["nonlinear equations", "Nonlinear Equations"],
  ["non linear functions", "Nonlinear Functions"],
  ["nonlinear functions", "Nonlinear Functions"],
  ["linear equations one variable", "Linear Equations in One Variable"],
  ["linear equations in one variable", "Linear Equations in One Variable"],
  ["linear equations two variables", "Linear Equations in Two Variables"],
  ["linear equations in two variables", "Linear Equations in Two Variables"],
  ["linear functions", "Linear Functions"],
  ["linear inequalities", "Linear Inequalities"],
  ["systems two linear equations and equations in two variables", "Systems of Two Linear Equations"],
  ["areas and volumes", "Area and Volume"],
  ["area and volume", "Area and Volume"],
  ["circles", "Circles"],
  ["lines angles triangles", "Lines, Angles, and Triangles"],
  ["right triangles and trigonometry", "Right Triangles and Trigonometry"],
  ["data and mean", "One-Variable Data: Distributions and Measures"],
  ["inference and margin of error", "Inference and Margin of Error"],
  ["one variable data", "One-Variable Data"],
  ["percentages", "Percentages"],
  ["probability", "Probability"],
  ["ratios rates proportions units", "Ratios, Rates, Proportions, and Units"],
  ["statistical claims", "Statistical Claims"],
  ["two variable data", "Two-Variable Data"],
  ["command evidence", "Command of Evidence"],
  ["double passage", "Cross-Text Connections"],
  ["inferences", "Inferences"],
  ["main idea and details", "Central Ideas and Details"],
  ["text structure and purpose", "Text Structure and Purpose"],
  ["words in context", "Words in Context"],
  ["boundaries", "Boundaries"],
  ["structure and grammar", "Grammar and Structure"],
  ["form structure and sense", "Grammar and Structure"],
  ["grammar and structure", "Grammar and Structure"],
  ["easy grammar", "Grammar and Structure"],
  ["medium grammar", "Grammar and Structure"],
  ["hard grammar", "Grammar and Structure"],
  ["student notes", "Rhetorical Synthesis"],
  ["sn easy", "Rhetorical Synthesis"],
  ["sn medium", "Rhetorical Synthesis"],
  ["sn hard", "Rhetorical Synthesis"],
  ["trans easy", "Transitions"],
  ["transitions", "Transitions"],
  ["transitions medium", "Transitions"],
  ["transitions hard", "Transitions"],
]);

const readingDomains = new Map([
  ["Command of Evidence", "Information and Ideas"],
  ["Cross-Text Connections", "Information and Ideas"],
  ["Inferences", "Information and Ideas"],
  ["Central Ideas and Details", "Information and Ideas"],
  ["Text Structure and Purpose", "Craft and Structure"],
  ["Words in Context", "Craft and Structure"],
]);

const writingDomains = new Map([
  ["Boundaries", "Standard English Conventions"],
  ["Grammar and Structure", "Standard English Conventions"],
  ["Form, Structure, and Sense", "Standard English Conventions"],
  ["Rhetorical Synthesis", "Expression of Ideas"],
  ["Transitions", "Expression of Ideas"],
]);

function detectDifficulty(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\beasy\b|\beasy\d+/.test(text)) return "EASY";
  if (/\bmed(?:ium)?\b|\bmed(?:ium)?\d+/.test(text)) return "MEDIUM";
  if (/\bhard\b|\bhard\d+|\bh\s*\d+\b/.test(text)) return "HARD";
  return null;
}

function detectVariant(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const match = text.match(/\b(?:hard|h|med(?:ium)?|easy)\s*(\d+)/);
  return match?.[1] ?? null;
}

function classifyPracticePath(relativePath) {
  const parts = String(relativePath).split("/").map((part) => part.trim()).filter(Boolean);
  const upper = parts.map((part) => part.toUpperCase());
  let section = null;
  let domainName = null;
  let topicName = null;
  const fileName = parts.at(-1) ?? "";

  if (upper.includes("EXERCISES MATH")) {
    const index = upper.indexOf("EXERCISES MATH");
    section = "MATH";
    domainName = mathDomains.get(normalizeKey(parts[index + 1])) ?? parts[index + 1] ?? null;
    topicName = skills.get(normalizeKey(parts[index + 2])) ?? parts[index + 2] ?? null;
  } else if (upper.includes("EXERCISES READING")) {
    const index = upper.indexOf("EXERCISES READING");
    section = "RW";
    topicName = skills.get(normalizeKey(parts[index + 1])) ?? parts[index + 1] ?? null;
    domainName = readingDomains.get(topicName) ?? null;
  } else if (upper.includes("EXERCISES WRITING")) {
    const index = upper.indexOf("EXERCISES WRITING");
    section = "RW";
    topicName = skills.get(normalizeKey(parts[index + 1])) ?? skills.get(normalizeKey(parts[index + 2])) ?? parts[index + 1] ?? null;
    domainName = writingDomains.get(topicName) ?? null;
  }

  return {
    section,
    domainName,
    topicName,
    difficulty: detectDifficulty(fileName, parts.slice(0, -1).join(" ")),
    practiceSetVariant: detectVariant(fileName, parts.slice(0, -1).join(" ")),
  };
}

function mergeWarnings(currentJson, message) {
  let parsed = [];
  try {
    const value = JSON.parse(currentJson || "[]");
    if (Array.isArray(value)) parsed = value;
  } catch {}
  if (!parsed.includes(message)) parsed.push(message);
  return JSON.stringify(parsed);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const updateSource = db.prepare(`
  UPDATE IngestSourceFile
  SET section = ?, domainName = ?, topicName = ?, difficulty = COALESCE(?, difficulty),
      difficultySource = CASE WHEN ? IS NOT NULL THEN 'PATH' ELSE difficultySource END,
      practiceSetVariant = COALESCE(?, practiceSetVariant),
      metadataWarningsJson = ?, updatedAt = datetime('now')
  WHERE id = ?
`);

const syncCandidates = db.prepare(`
  UPDATE IngestQuestionCandidate
  SET section = (SELECT section FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      domainName = (SELECT domainName FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      topicName = (SELECT topicName FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      difficulty = (SELECT difficulty FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      difficultySource = (SELECT difficultySource FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      practiceSetVariant = (SELECT practiceSetVariant FROM IngestSourceFile WHERE IngestSourceFile.id = IngestQuestionCandidate.sourceFileId),
      updatedAt = datetime('now')
  WHERE contentType = 'PRACTICE_SET'
`);

const syncAnswerSections = db.prepare(`
  UPDATE IngestAnswerCandidate
  SET section = (SELECT section FROM IngestSourceFile WHERE IngestSourceFile.id = IngestAnswerCandidate.sourceFileId)
  WHERE sourceFileId IN (SELECT id FROM IngestSourceFile WHERE contentType = 'PRACTICE_SET')
`);

const transaction = db.transaction(() => {
  const rows = db.prepare("SELECT * FROM IngestSourceFile WHERE contentType = 'PRACTICE_SET'").all();
  let sourceUpdates = 0;
  for (const row of rows) {
    const next = classifyPracticePath(row.relativePath);
    if (!next.section || !next.domainName || !next.topicName) continue;
    const changed =
      row.section !== next.section ||
      row.domainName !== next.domainName ||
      row.topicName !== next.topicName ||
      (next.difficulty && row.difficulty !== next.difficulty) ||
      (next.practiceSetVariant && row.practiceSetVariant !== next.practiceSetVariant);
    if (!changed) continue;
    const warnings = mergeWarnings(row.metadataWarningsJson, "Existing ingest metadata realigned to official SAT taxonomy from source folder structure.");
    updateSource.run(
      next.section,
      next.domainName,
      next.topicName,
      next.difficulty,
      next.difficulty,
      next.practiceSetVariant,
      warnings,
      row.id,
    );
    sourceUpdates += 1;
  }
  const candidateUpdates = syncCandidates.run().changes;
  const answerUpdates = syncAnswerSections.run().changes;
  return { sourceUpdates, candidateUpdates, answerUpdates };
});

const result = transaction();
const sourceSummary = db.prepare(`
  SELECT section, domainName, topicName, COUNT(*) count
  FROM IngestSourceFile
  WHERE contentType = 'PRACTICE_SET'
  GROUP BY section, domainName, topicName
  ORDER BY section, domainName, topicName
`).all();
const candidateSummary = db.prepare(`
  SELECT domainName, topicName, COUNT(*) count
  FROM IngestQuestionCandidate
  WHERE contentType = 'PRACTICE_SET'
  GROUP BY domainName, topicName
  ORDER BY count DESC
  LIMIT 20
`).all();

console.log(JSON.stringify({ dbPath, ...result, sourceGroups: sourceSummary.length }, null, 2));
console.table(sourceSummary);
console.table(candidateSummary);
db.close();
