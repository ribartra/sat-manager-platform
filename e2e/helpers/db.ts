import bcrypt from "bcryptjs";
import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";

function dbPath() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const file = raw.replace(/^file:/, "");
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
}

export function openDb() {
  const db = new Database(dbPath());
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

/** Delete leftover e2e users (emails starting with e2e.) and related rows. */
export function cleanupE2eUsers(emailPrefix = "e2e.") {
  const db = openDb();
  try {
    const users = db
      .prepare(`SELECT id, email, role FROM User WHERE email LIKE ?`)
      .all(`${emailPrefix}%`) as Array<{ id: string; email: string; role: string }>;
    if (!users.length) return { deleted: 0 };

    for (const user of users) {
      db.prepare(`DELETE FROM ParentAccessToken WHERE studentId = ? OR parentId = ? OR createdById = ?`).run(
        user.id,
        user.id,
        user.id
      );
      db.prepare(`DELETE FROM ParentStudent WHERE parentId = ? OR studentId = ?`).run(user.id, user.id);
      db.prepare(`DELETE FROM AttemptAnswer WHERE attemptId IN (SELECT id FROM Attempt WHERE studentId = ?)`).run(
        user.id
      );
      db.prepare(`DELETE FROM Attempt WHERE studentId = ?`).run(user.id);
      db.prepare(`DELETE FROM Assignment WHERE studentId = ? OR assignedById = ?`).run(user.id, user.id);
      db.prepare(`DELETE FROM ProgramEnrollment WHERE studentId = ?`).run(user.id);
      db.prepare(`DELETE FROM Notification WHERE userId = ?`).run(user.id);
      db.prepare(`DELETE FROM AuditLog WHERE userId = ?`).run(user.id);
      db.prepare(`DELETE FROM PasswordResetToken WHERE userId = ?`).run(user.id);
      db.prepare(`DELETE FROM InviteToken WHERE email = ? OR parentEmail = ?`).run(user.email, user.email);
    }

    const emails = users.map((u) => u.email);
    for (const email of emails) {
      db.prepare(`DELETE FROM InviteToken WHERE email = ? OR parentEmail = ?`).run(email, email);
    }
    for (const user of users) {
      db.prepare(`DELETE FROM User WHERE id = ?`).run(user.id);
    }
    return { deleted: users.length };
  } finally {
    db.close();
  }
}

export function setUserPassword(email: string, password: string) {
  const db = openDb();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare(
        `UPDATE User SET passwordHash = ?, validationStatus = 'APPROVED', active = 1, validationReviewedAt = CURRENT_TIMESTAMP WHERE email = ?`
      )
      .run(hash, email);
    return info.changes > 0;
  } finally {
    db.close();
  }
}

export function findUserByEmail(email: string) {
  const db = openDb();
  try {
    return db
      .prepare(`SELECT id, email, name, role, validationStatus, active FROM User WHERE email = ?`)
      .get(email) as
      | { id: string; email: string; name: string; role: string; validationStatus: string; active: number }
      | undefined;
  } finally {
    db.close();
  }
}

export type PromotedEasyPracticeSet = {
  id: string;
  name: string;
  questionCount: number;
  sourcePath: string | null;
};

/**
 * Pick a real EASY Practice Set promoted from ingest (IngestPromotionArtifact),
 * preferring small sets whose questions were also promoted.
 */
export function findPromotedEasyPracticeSet(options?: {
  maxQuestions?: number;
  preferNameIncludes?: string;
}): PromotedEasyPracticeSet {
  const maxQuestions = options?.maxQuestions ?? 6;
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
      SELECT
        ps.id AS id,
        ps.name AS name,
        COUNT(DISTINCT psq.questionId) AS questionCount,
        MIN(sf.relativePath) AS sourcePath,
        SUM(CASE WHEN qa.id IS NOT NULL THEN 1 ELSE 0 END) AS promotedQuestions
      FROM IngestPromotionArtifact a
      JOIN PracticeSet ps ON ps.id = a.artifactId AND a.artifactType = 'PRACTICE_SET'
      JOIN PracticeSetQuestion psq ON psq.practiceSetId = ps.id
      LEFT JOIN IngestPromotionArtifact qa
        ON qa.artifactType = 'QUESTION' AND qa.artifactId = psq.questionId
      LEFT JOIN IngestSourceFile sf ON sf.id = a.sourceFileId
      WHERE ps.difficulty = 'EASY' AND ps.status = 'PUBLISHED'
      GROUP BY ps.id
      HAVING questionCount >= 1
        AND questionCount <= ?
        AND promotedQuestions = questionCount
      ORDER BY questionCount ASC, ps.name ASC
      `
      )
      .all(maxQuestions) as Array<{
      id: string;
      name: string;
      questionCount: number;
      sourcePath: string | null;
      promotedQuestions: number;
    }>;

    if (!rows.length) {
      throw new Error(
        "No published EASY Practice Set found with IngestPromotionArtifact (PRACTICE_SET + QUESTIONS)."
      );
    }

    const preferred = options?.preferNameIncludes
      ? rows.find((row) => row.name.toLowerCase().includes(options.preferNameIncludes!.toLowerCase()))
      : undefined;
    const chosen = preferred ?? rows[0];
    return {
      id: chosen.id,
      name: chosen.name,
      questionCount: Number(chosen.questionCount),
      sourcePath: chosen.sourcePath,
    };
  } finally {
    db.close();
  }
}

export function createApprovedStudent(input: { email: string; name: string; password: string }) {
  const db = openDb();
  try {
    const existing = db.prepare(`SELECT id FROM User WHERE email = ?`).get(input.email) as { id: string } | undefined;
    const hash = bcrypt.hashSync(input.password, 10);
    if (existing) {
      db.prepare(
        `UPDATE User SET name = ?, passwordHash = ?, role = 'STUDENT', validationStatus = 'APPROVED', active = 1 WHERE id = ?`
      ).run(input.name, hash, existing.id);
      return existing.id;
    }
    const id = `e2e_stu_${crypto.randomBytes(8).toString("hex")}`;
    db.prepare(
      `INSERT INTO User (id, name, email, passwordHash, role, active, validationStatus, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'STUDENT', 1, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, input.name, input.email, hash);
    return id;
  } finally {
    db.close();
  }
}

/**
 * Mirrors POST /api/parents/access-links token creation so e2e can open
 * /parent/access?token=… without depending on SMTP delivery of the raw token.
 */
export function createParentAccessToken(input: {
  studentId: string;
  parentId: string;
  createdById: string;
  areas?: string;
}) {
  const db = openDb();
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const id = `e2e_pat_${crypto.randomBytes(8).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO ParentAccessToken (id, studentId, parentId, createdById, areas, tokenHash, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(
      id,
      input.studentId,
      input.parentId,
      input.createdById,
      input.areas ?? "mathematics,reading,writing",
      tokenHash,
      expiresAt
    );
    return { id, token, urlPath: `/parent/access?token=${token}` };
  } finally {
    db.close();
  }
}

/**
 * Seed a minor-student invite where the student already activated (usedAt set)
 * but parent consent is still pending — reproduces the prior “invalid link” bug.
 */
export function createUsedInviteWithPendingParentConsent(input: {
  studentEmail: string;
  studentName: string;
  parentEmail: string;
  parentName: string;
  invitedById: string;
  programId: string;
}) {
  const db = openDb();
  try {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    const consentToken = crypto.randomBytes(32).toString("hex");
    const consentTokenHash = crypto.createHash("sha256").update(consentToken).digest("hex");
    const id = `e2e_inv_${crypto.randomBytes(8).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const usedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO InviteToken (
         id, role, email, name, invitedById, programId, isMinor,
         parentName, parentEmail, parentConsentToken, parentConsentTokenHash,
         token, tokenHash, expiresAt, usedAt
       ) VALUES (?, 'STUDENT', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.studentEmail,
      input.studentName,
      input.invitedById,
      input.programId,
      input.parentName,
      input.parentEmail,
      `hashed:${consentTokenHash}`,
      consentTokenHash,
      `hashed:${inviteTokenHash}`,
      inviteTokenHash,
      expiresAt,
      usedAt
    );
    return {
      id,
      inviteToken,
      consentToken,
      consentUrlPath: `/auth/parent-consent?token=${consentToken}`,
    };
  } finally {
    db.close();
  }
}

export function countAuditActions(actions: string[], sinceIso?: string) {
  const db = openDb();
  try {
    const placeholders = actions.map(() => "?").join(",");
    const rows = sinceIso
      ? (db
          .prepare(
            `SELECT action, COUNT(*) as c FROM AuditLog WHERE action IN (${placeholders}) AND createdAt >= ? GROUP BY action`
          )
          .all(...actions, sinceIso) as Array<{ action: string; c: number }>)
      : (db
          .prepare(`SELECT action, COUNT(*) as c FROM AuditLog WHERE action IN (${placeholders}) GROUP BY action`)
          .all(...actions) as Array<{ action: string; c: number }>);
    return Object.fromEntries(rows.map((r) => [r.action, r.c]));
  } finally {
    db.close();
  }
}

export function findActiveProgramId() {
  const db = openDb();
  try {
    const row = db
      .prepare(`SELECT id FROM Program WHERE active = 1 ORDER BY createdAt ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  } finally {
    db.close();
  }
}
