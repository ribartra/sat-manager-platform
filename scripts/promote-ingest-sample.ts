import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const SAMPLE_SET_IDS = {
  EASY: "ai-sample-easy",
  MEDIUM: "ai-sample-medium",
  HARD: "ai-sample-hard",
} as const;

const SAMPLE_GROUP_PREFIX = "script-sample:";
const DEFAULT_STUDENTS = ["student1@sat.com", "student2@sat.com"];
const DEFAULT_PER_DIFFICULTY = 5;
const TARGETS = {
  EASY: { topicName: "LINEAR EQUATIONS TWO VARIABLES", fallbackTopicId: "top-lineq" },
  MEDIUM: { topicName: "LINEAR FUNCTIONS", fallbackTopicId: "top-linfn" },
  HARD: { topicName: "EQUIVALENT EXPRESSION", fallbackTopicId: "top-poly" },
} as const;

type Difficulty = keyof typeof TARGETS;
type Candidate = NonNullable<Awaited<ReturnType<typeof prisma.ingestQuestionCandidate.findFirst>>>;
type Topic = Awaited<ReturnType<typeof loadTopics>>[number];

type CliOptions = {
  batchId?: string;
  perDifficulty: number;
  studentEmails: string[];
  resetSample: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    perDifficulty: DEFAULT_PER_DIFFICULTY,
    studentEmails: DEFAULT_STUDENTS,
    resetSample: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--batch") options.batchId = argv[++index];
    else if (arg === "--per-difficulty") options.perDifficulty = Number(argv[++index] ?? DEFAULT_PER_DIFFICULTY);
    else if (arg === "--students") {
      options.studentEmails = String(argv[++index] ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    } else if (arg === "--reset-sample") options.resetSample = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.perDifficulty) || options.perDifficulty < 1) {
    throw new Error("--per-difficulty must be a positive number.");
  }
  if (!options.studentEmails.length) {
    throw new Error("--students must include at least one student email.");
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run sample:promote -- [options]

Options:
  --batch <batchId>              Use a specific ingest batch. Defaults to latest batch.
  --per-difficulty <n>           Questions per Easy/Medium/Hard set. Default: ${DEFAULT_PER_DIFFICULTY}
  --students <email,email>       Approved student emails to assign. Default: ${DEFAULT_STUDENTS.join(",")}
  --reset-sample                 Remove only content created by this script before rebuilding it.
  --dry-run                      Show what would be promoted without writing to the database.
`);
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMarkdownImageRefs(value: string | null | undefined) {
  return (value ?? "").replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function parseOptions(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((option, index) => ({
        label: String(option?.label ?? String.fromCharCode(65 + index)).trim().toUpperCase(),
        text: stripMarkdownImageRefs(String(option?.text ?? option?.value ?? "")),
        imageUrl: option?.imageUrl ? String(option.imageUrl) : null,
      }))
      .filter((option) => option.label);
  } catch {
    return [];
  }
}

function isValidMultipleChoice(candidate: Pick<Candidate, "type" | "stem" | "optionsJson" | "correctAnswer" | "explanation">) {
  if (candidate.type !== "MC") return false;
  if (!stripMarkdownImageRefs(candidate.stem)) return false;
  if (!stripMarkdownImageRefs(candidate.explanation)) return false;
  if (!["A", "B", "C", "D"].includes((candidate.correctAnswer ?? "").trim().toUpperCase())) return false;

  const options = parseOptions(candidate.optionsJson);
  return ["A", "B", "C", "D"].every((label) => {
    const option = options.find((item) => item.label === label);
    return Boolean(option?.text || option?.imageUrl);
  });
}

async function loadTopics() {
  return prisma.topic.findMany({
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });
}

function resolveTopic(candidate: Candidate, topics: Topic[], fallbackTopicId: string) {
  const topicAliases = new Map<string, string>([
    ["linear equations two variables", "linear equations"],
    ["linear equations one variable", "linear equations"],
    ["systems two linear equations and equations in two variables", "systems of equations"],
    ["linear inequalities", "inequalities"],
    ["equivalent expression", "polynomials"],
    ["non linear functions", "quadratic functions"],
    ["non linear equations", "quadratic functions"],
    ["areas and volumes", "volume and area"],
    ["right triangles and trigonometry", "trigonometry"],
    ["ratios rates proportions units", "ratios and proportions"],
    ["data and mean", "statistics"],
    ["one variable data", "statistics"],
    ["two variable data", "statistics"],
    ["statistical claims", "statistics"],
    ["inference and margin of error", "statistics"],
  ]);

  const rawTopic = normalize(candidate.topicName);
  const targetTopic = topicAliases.get(rawTopic) ?? rawTopic;
  const rawDomain = normalize(candidate.domainName);
  const section = normalize(candidate.section);

  const exact = topics.find((topic) => {
    const sameTopic = normalize(topic.name) === targetTopic;
    const sameSection = !section || [normalize(topic.domain.section.name), normalize(topic.domain.section.label)].includes(section);
    return sameTopic && sameSection;
  });
  if (exact) return exact.id;

  const byDomain = topics.find((topic) => {
    const sameDomain = normalize(topic.domain.name) === rawDomain;
    const sameSection = !section || [normalize(topic.domain.section.name), normalize(topic.domain.section.label)].includes(section);
    return sameDomain && sameSection;
  });
  return byDomain?.id ?? fallbackTopicId;
}

function questionExternalId(candidate: Candidate) {
  const explicit = stripMarkdownImageRefs(candidate.questionExternalId);
  if (explicit) return explicit;
  const match = stripMarkdownImageRefs(candidate.stem).match(/(?:Question\s+)?ID:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? candidate.id;
}

async function latestBatchId(explicitBatchId?: string) {
  if (explicitBatchId) {
    const batch = await prisma.ingestBatch.findUnique({ where: { id: explicitBatchId } });
    if (!batch) throw new Error(`Batch not found: ${explicitBatchId}`);
    return batch.id;
  }
  const batch = await prisma.ingestBatch.findFirst({ orderBy: { createdAt: "desc" } });
  if (!batch) throw new Error("No ingest batch exists.");
  return batch.id;
}

async function selectCandidates(batchId: string, difficulty: Difficulty, perDifficulty: number) {
  const target = TARGETS[difficulty];
  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: {
      batchId,
      contentType: "PRACTICE_SET",
      difficulty,
      topicName: target.topicName,
      status: { in: ["READY", "REVIEWED"] },
      promotionStatus: { not: "REJECTED" },
    },
    orderBy: [{ sourceFileId: "asc" }, { questionNumber: "asc" }, { id: "asc" }],
    take: Math.max(perDifficulty * 12, 80),
  });

  const valid = candidates.filter(isValidMultipleChoice).slice(0, perDifficulty);
  if (valid.length < perDifficulty) {
    throw new Error(`Only ${valid.length} valid ${difficulty} candidates were found for ${target.topicName}. Requested ${perDifficulty}.`);
  }
  return valid;
}

async function resetSample() {
  const sampleSetIds = Object.values(SAMPLE_SET_IDS);
  const artifacts = await prisma.ingestPromotionArtifact.findMany({
    where: {
      artifactType: "QUESTION",
      groupKey: { startsWith: SAMPLE_GROUP_PREFIX },
    },
    select: { artifactId: true, groupKey: true },
  });
  const questionIds = [...new Set(artifacts.map((artifact) => artifact.artifactId))];
  const candidateIds = artifacts
    .map((artifact) => artifact.groupKey.replace(SAMPLE_GROUP_PREFIX, ""))
    .filter(Boolean);

  await prisma.assignment.deleteMany({ where: { practiceSetId: { in: sampleSetIds } } });
  await prisma.practiceSet.deleteMany({ where: { id: { in: sampleSetIds } } });
  await prisma.ingestPromotionArtifact.deleteMany({
    where: { groupKey: { startsWith: SAMPLE_GROUP_PREFIX } },
  });
  if (candidateIds.length) {
    await prisma.ingestQuestionCandidate.updateMany({
      where: { id: { in: candidateIds } },
      data: { officialQuestionId: null, promotionStatus: "NOT_PROMOTED", promotedAt: null, promotedById: null },
    });
  }
  if (questionIds.length) {
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
  }

  console.log(`Reset sample content: ${questionIds.length} questions, ${sampleSetIds.length} practice set slots.`);
}

async function promoteCandidate(candidate: Candidate, topicId: string, teacherId: string) {
  if (candidate.officialQuestionId && candidate.promotionStatus === "PROMOTED") {
    const existing = await prisma.question.findUnique({ where: { id: candidate.officialQuestionId } });
    if (existing) return existing;
  }

  const groupKey = `${SAMPLE_GROUP_PREFIX}${candidate.id}`;
  const artifact = await prisma.ingestPromotionArtifact.findFirst({
    where: { artifactType: "QUESTION", groupKey },
  });
  if (artifact) {
    const existing = await prisma.question.findUnique({ where: { id: artifact.artifactId } });
    if (existing) return existing;
  }

  const options = parseOptions(candidate.optionsJson);
  const question = await prisma.question.create({
    data: {
      stem: stripMarkdownImageRefs(candidate.stem),
      stimulus: stripMarkdownImageRefs(candidate.stimulus) || null,
      type: "MC",
      difficulty: candidate.difficulty ?? "EASY",
      correctAnswer: (candidate.correctAnswer ?? "").trim().toUpperCase(),
      explanation: stripMarkdownImageRefs(candidate.explanation) || null,
      topicId,
      status: "PUBLISHED",
      options: {
        create: ["A", "B", "C", "D"].map((label) => {
          const option = options.find((item) => item.label === label);
          return { label, text: option?.text ?? "", imageUrl: option?.imageUrl };
        }),
      },
    },
  });

  await prisma.ingestQuestionCandidate.update({
    where: { id: candidate.id },
    data: {
      officialQuestionId: question.id,
      promotionStatus: "PROMOTED",
      promotedAt: new Date(),
      promotedById: teacherId,
    },
  });

  await prisma.ingestPromotionArtifact.upsert({
    where: {
      batchId_artifactType_groupKey: {
        batchId: candidate.batchId,
        artifactType: "QUESTION",
        groupKey,
      },
    },
    update: { artifactId: question.id, sourceFileId: candidate.sourceFileId, createdById: teacherId },
    create: {
      id: `prom_${crypto.randomUUID().replace(/-/g, "")}`,
      batchId: candidate.batchId,
      sourceFileId: candidate.sourceFileId,
      artifactType: "QUESTION",
      artifactId: question.id,
      groupKey,
      createdById: teacherId,
    },
  });

  return question;
}

async function createPracticeSet({
  id,
  name,
  difficulty,
  topicId,
  questionIds,
}: {
  id: string;
  name: string;
  difficulty: Difficulty;
  topicId: string;
  questionIds: string[];
}) {
  await prisma.assignment.deleteMany({ where: { practiceSetId: id } });
  await prisma.practiceSet.upsert({
    where: { id },
    update: {
      name,
      topicId,
      difficulty,
      status: "PUBLISHED",
      explanationVisibility: "AFTER_FINISH",
      questions: {
        deleteMany: {},
        create: questionIds.map((questionId, index) => ({ questionId, order: index + 1 })),
      },
    },
    create: {
      id,
      name,
      topicId,
      difficulty,
      status: "PUBLISHED",
      explanationVisibility: "AFTER_FINISH",
      questions: {
        create: questionIds.map((questionId, index) => ({ questionId, order: index + 1 })),
      },
    },
  });
}

async function assignPracticeSets(practiceSetIds: string[], studentIds: string[], teacherId: string) {
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  for (const practiceSetId of practiceSetIds) {
    for (const studentId of studentIds) {
      const existing = await prisma.assignment.findFirst({ where: { practiceSetId, studentId } });
      if (existing) {
        await prisma.assignment.update({
          where: { id: existing.id },
          data: { assignedById: teacherId, dueDate, unlockAt: existing.unlockAt ?? existing.createdAt, locked: false, status: "PENDING" },
        });
      } else {
        await prisma.assignment.create({
          data: { practiceSetId, studentId, assignedById: teacherId, dueDate, unlockAt: new Date(), locked: false, status: "PENDING" },
        });
      }
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const batchId = await latestBatchId(options.batchId);
  const [topics, teacher, students] = await Promise.all([
    loadTopics(),
    prisma.user.findUnique({ where: { email: "teacher@sat.com" } }),
    prisma.user.findMany({
      where: {
        email: { in: options.studentEmails },
        role: "STUDENT",
        active: true,
        validationStatus: "APPROVED",
      },
      orderBy: { email: "asc" },
    }),
  ]);

  if (!teacher || !teacher.active || teacher.validationStatus !== "APPROVED") {
    throw new Error("teacher@sat.com must exist and be approved before assigning sample content.");
  }
  const missingStudents = options.studentEmails.filter((email) => !students.some((student) => student.email === email));
  if (missingStudents.length) {
    throw new Error(`Approved students not found: ${missingStudents.join(", ")}`);
  }

  const plan = await Promise.all(
    (Object.keys(TARGETS) as Difficulty[]).map(async (difficulty) => {
      const candidates = await selectCandidates(batchId, difficulty, options.perDifficulty);
      const topicId = resolveTopic(candidates[0], topics, TARGETS[difficulty].fallbackTopicId);
      return { difficulty, candidates, topicId };
    }),
  );

  console.log(`Batch: ${batchId}`);
  console.log(`Students: ${students.map((student) => student.email).join(", ")}`);
  for (const item of plan) {
    console.log(`${item.difficulty}: ${item.candidates.length} candidates from ${TARGETS[item.difficulty].topicName} -> topic ${item.topicId}`);
    item.candidates.forEach((candidate, index) => {
      console.log(`  ${index + 1}. ${candidate.id} (${questionExternalId(candidate)}) answer ${candidate.correctAnswer}`);
    });
  }

  if (options.dryRun) {
    console.log("Dry run complete. No database changes were made.");
    return;
  }

  if (options.resetSample) await resetSample();

  const createdSetIds: string[] = [];
  for (const item of plan) {
    const questionIds: string[] = [];
    for (const candidate of item.candidates) {
      const question = await promoteCandidate(candidate, item.topicId, teacher.id);
      questionIds.push(question.id);
    }

    const setId = SAMPLE_SET_IDS[item.difficulty];
    const readableName = `AI Sample ${item.difficulty[0]}${item.difficulty.slice(1).toLowerCase()}`;
    await createPracticeSet({
      id: setId,
      name: `${readableName} Practice Set`,
      difficulty: item.difficulty,
      topicId: item.topicId,
      questionIds,
    });
    createdSetIds.push(setId);
  }

  await assignPracticeSets(createdSetIds, students.map((student) => student.id), teacher.id);

  await prisma.auditLog.create({
    data: {
      userId: teacher.id,
      action: "SCRIPT_PROMOTE_INGEST_SAMPLE",
      targetType: "IngestBatch",
      targetId: batchId,
      metadata: JSON.stringify({
        perDifficulty: options.perDifficulty,
        practiceSetIds: createdSetIds,
        studentEmails: students.map((student) => student.email),
      }),
    },
  });

  console.log(`Promoted/assigned ${createdSetIds.length} Practice Sets with ${options.perDifficulty} questions each.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
