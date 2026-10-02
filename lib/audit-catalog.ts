/**
 * Canonical audit action catalog for Admin → Audit Log.
 * Unknown codes still render via humanizeAction() so SCREAMING_SNAKE never shows as the primary label.
 */

export type AuditCategory = "Auth" | "Users" | "Attempts" | "Content" | "Import" | "Programs" | "Errors" | "Other";

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Auth
  LOGIN_SUCCESS: "Login succeeded",
  LOGIN_FAILED: "Login failed",
  LOGIN_RATE_LIMITED: "Login rate limited",
  PASSWORD_CHANGED: "Password changed",
  PASSWORD_CHANGE_FAILED: "Password change failed",
  PASSWORD_RESET_REQUESTED: "Password reset requested",
  PASSWORD_RESET_COMPLETED: "Password reset completed",
  PASSWORD_RESET_FAILED: "Password reset failed",
  EMAIL_URL_MISCONFIGURED: "Email app URL misconfigured",
  ERROR_CAUGHT: "Caught application error",

  // Users / invites / parents
  INVITE_CREATED: "Invitation created",
  INVITE_EMAIL_SENT: "Invitation email sent",
  INVITE_EMAIL_FAILED: "Invitation email failed",
  INVITE_VIEWED: "Invitation link reviewed",
  INVITE_VIEW_FAILED: "Invitation link review failed",
  USER_ACTIVATED: "User account activated",
  USER_CREATE_FAILED: "User activation failed",
  UPDATE_STUDENT: "Student updated",
  UPDATE_PARENT: "Parent updated",
  LINK_PARENT_STUDENT: "Parent linked to student",
  UNLINK_PARENT_STUDENT: "Parent unlinked from student",
  PARENT_CONSENT_VIEWED: "Parent consent link reviewed",
  PARENT_CONSENT_VIEW_FAILED: "Parent consent link failed",
  PARENT_CONSENT_RECORDED: "Parent consent recorded",
  PARENT_LINK_SKIPPED: "Parent link skipped (email belongs to another account type)",
  PARENT_REPORT_LINK_CREATED: "Parent report link created",
  SHARE_PARENT_REPORT_LINK: "Parent report link shared",
  CREATE_PARENT_ACCESS_LINK: "Parent access link created",
  PARENT_REPORT_OPENED: "Parent report opened",
  PARENT_REPORT_OPEN_FAILED: "Parent report open failed",
  IMPERSONATE_STUDENT_VIEW: "Viewed as student",

  // Attempts
  ATTEMPT_STARTED: "Practice attempt started",
  ATTEMPT_RESUMED: "Practice attempt resumed",
  ATTEMPT_PAUSED: "Practice attempt paused",
  ATTEMPT_SUBMITTED: "Practice attempt submitted",
  FPT_ATTEMPT_STARTED: "Exam attempt started",
  FPT_ATTEMPT_RESUMED: "Exam attempt resumed",
  FPT_ATTEMPT_PAUSED: "Exam attempt paused",
  FPT_ATTEMPT_SUBMITTED: "Exam attempt submitted",
  INVALIDATE_ATTEMPT: "Attempt invalidated",
  REOPEN_ATTEMPT: "Attempt reopened",
  COMMENT_ATTEMPT: "Attempt commented",
  ASSIGN_PRACTICE_SET: "Practice Set assigned",
  ASSIGN_FULL_PRACTICE_TEST: "Exam assigned",
  AUTO_CREATE_ASSIGNMENT: "Assignment auto-created",
  AUTO_UNLOCK_ASSIGNMENT: "Assignment auto-unlocked",
  AUTO_UNLOCK_SKIPPED_MANUAL_LOCK: "Auto-unlock skipped (manual lock)",
  AUTO_UNLOCK_SKIPPED_SCHEDULED_LOCK: "Auto-unlock skipped (scheduled lock)",
  CREATE_UNLOCK_REQUEST: "Unlock requested",
  APPROVE_UNLOCK_REQUEST: "Unlock request approved",
  ASSIGN_GROUP_PRACTICE_SET: "Practice Set assigned to group",
  DENY_UNLOCK_REQUEST: "Unlock request denied",

  // Content
  CREATE_QUESTION: "Question created",
  UPDATE_QUESTION: "Question updated",
  PUBLISH_QUESTION: "Question published",
  ARCHIVE_QUESTION: "Question archived",
  DRAFT_QUESTION: "Question set to draft",
  DELETE_QUESTION: "Question deleted",
  DUPLICATE_QUESTION: "Question duplicated",
  CREATE_PRACTICE_SET: "Practice Set created",
  UPDATE_PRACTICE_SET: "Practice Set updated",
  PUBLISH_PRACTICE_SET: "Practice Set published",
  ARCHIVE_PRACTICE_SET: "Practice Set archived",
  DELETE_PRACTICE_SET: "Practice Set deleted",
  DUPLICATE_PRACTICE_SET: "Practice Set duplicated",
  CREATE_FULL_PRACTICE_TEST: "Exam created",
  UPDATE_FULL_PRACTICE_TEST: "Exam updated",
  PUBLISH_FULL_PRACTICE_TEST: "Exam published",
  ARCHIVE_FULL_PRACTICE_TEST: "Exam archived",
  DELETE_FULL_PRACTICE_TEST: "Exam deleted",
  DUPLICATE_FULL_PRACTICE_TEST: "Exam duplicated",
  CREATE_STUDY_MATERIAL: "Study material created",
  UPDATE_STUDY_MATERIAL: "Study material updated",
  DELETE_STUDY_MATERIAL: "Study material deleted",
  DUPLICATE_STUDY_MATERIAL: "Study material duplicated",
  CREATE_SUBSKILL: "Subskill created",
  UPDATE_SUBSKILL: "Subskill updated",
  DELETE_SUBSKILL: "Subskill deleted",
  CREATE_TAXONOMY_NODE: "Taxonomy node created",
  UPDATE_TAXONOMY_NODE: "Taxonomy node updated",
  IMPORT_QUESTIONS: "Questions imported",

  // Programs / groups
  CREATE_PROGRAM: "Program created",
  UPDATE_PROGRAM: "Program updated",
  DELETE_PROGRAM: "Program deleted",
  RESTORE_PROGRAM: "Program restored",
  REQUEST_ENROLLMENT: "Enrollment requested",
  APPROVE_ENROLLMENT: "Enrollment approved",
  REJECT_ENROLLMENT: "Enrollment rejected",
  REMOVE_ENROLLMENT: "Enrollment removed",
  ADD_PROGRAM_TEACHER: "Teacher added to program",
  REMOVE_PROGRAM_TEACHER: "Teacher removed from program",
  CREATE_GROUP: "Group created",
  UPDATE_GROUP: "Group updated",
  DELETE_GROUP: "Group deleted",
  ADD_GROUP_MEMBER: "Student added to group",
  REMOVE_GROUP_MEMBER: "Student removed from group",

  // Settings
  UPDATE_APP_SETTING: "App setting updated",
  UPDATE_MISTRAL_API_KEY: "Mistral API key updated",
  UPDATE_SMTP_SETTINGS: "SMTP settings updated",

  // AI import / ingest
  CREATE_AI_IMPORT_BATCH: "AI import batch created",
  UPLOAD_AI_IMPORT_ZIP: "AI import ZIP uploaded",
  UPLOAD_AI_IMPORT_SOURCES: "AI import sources uploaded",
  PROCESS_AI_IMPORT_BATCH: "AI import batch processed",
  UPDATE_AI_IMPORT_REVIEW_SESSION: "AI import review session updated",
  UPDATE_AI_IMPORT_CANDIDATE: "AI import candidate updated",
  MARK_AI_IMPORT_CANDIDATE_EDITING: "AI import candidate marked editing",
  MERGE_AI_IMPORT_CANDIDATE: "AI import candidates merged",
  LINK_AI_IMPORT_IMAGE: "AI import image linked",
  UNLINK_AI_IMPORT_IMAGE: "AI import image unlinked",
  PARSE_AI_IMPORT_OPTION_IMAGE: "AI import option image parsed",
  PROMOTE_AI_IMPORT_QUESTIONS: "AI import questions promoted",
  PROMOTE_AI_IMPORT_PRACTICE_SET: "AI import Practice Set promoted",
  PROMOTE_AI_IMPORT_FULL_TEST: "AI import Exam promoted",
  ATTACH_QUESTION_IMAGE_FROM_GALLERY: "Question image attached from gallery",
  UPLOAD_QUESTION_IMAGE: "Question image uploaded",
  AI_IMPORT_CROP_OCR: "AI import crop OCR",
  AI_IMPORT_CROP_ASSIGN: "AI import crop assigned",
  RETRY_AI_IMPORT_FAILED_JOBS: "AI import failed jobs retried",
  FIX_INGEST_ANSWER_KEY: "Ingest answer key fixed",
  FIX_INGEST_MULTIANSWER_PARSE: "Ingest multi-answer parse fixed",
  SPLIT_RW_STIMULUS_FROM_STEM: "R&W stimulus split from stem",
  RECOVER_RW_STIMULUS: "R&W stimulus recovered",
  RECOVER_RW_STIMULUS_SHORTSTEM: "R&W short-stem stimulus recovered",
  RECOVER_RW_STIMULUS_POSITIONAL: "R&W positional stimulus recovered",
  RECOVER_RW_OPTIONS_POSITIONAL: "R&W positional options recovered",
  RECOVER_EXPLANATIONS_OCR: "Explanations recovered via OCR",
  CLEAR_MISASSIGNED_QUESTION_IMAGE: "Misassigned question image cleared",
  ATTACH_RW_PAGE_IMAGE: "R&W page image attached",
  SCRIPT_PROMOTE_INGEST_SAMPLE: "Ingest sample promoted (script)",
  RESET_SCRIPT_PROMOTE_INGEST_SAMPLE: "Ingest sample promote reset (script)",
  SEED_QA_TRANSITION_READY: "Seed: QA transition ready",
  SEED_ACADEMIC_CONTENT_DISABLED: "Seed: academic content disabled",
  SEED_QA_FPT_MOCKS_READY: "Seed: exam mocks ready",
};

/** Turn SCREAMING_SNAKE into a readable sentence-case label. */
export function humanizeAction(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const words = action
    .split("_")
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (!words.length) return action;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

export function actionCategory(action: string): AuditCategory {
  if (action === "ERROR_CAUGHT" || action === "EMAIL_URL_MISCONFIGURED") return "Errors";
  if (action.startsWith("LOGIN_") || action.startsWith("PASSWORD_")) return "Auth";
  if (
    action.startsWith("INVITE_") ||
    action.startsWith("USER_") ||
    action.startsWith("PARENT_") ||
    action === "UPDATE_STUDENT" ||
    action === "UPDATE_PARENT" ||
    action === "LINK_PARENT_STUDENT" ||
    action === "UNLINK_PARENT_STUDENT" ||
    action === "IMPERSONATE_STUDENT_VIEW" ||
    action === "SHARE_PARENT_REPORT_LINK" ||
    action === "CREATE_PARENT_ACCESS_LINK"
  ) {
    return "Users";
  }
  if (
    action.startsWith("ATTEMPT_") ||
    action.startsWith("FPT_") ||
    action.includes("ASSIGN") ||
    action.includes("UNLOCK") ||
    action === "INVALIDATE_ATTEMPT" ||
    action === "REOPEN_ATTEMPT" ||
    action === "COMMENT_ATTEMPT"
  ) {
    return "Attempts";
  }
  if (
    action.includes("AI_IMPORT") ||
    action.includes("INGEST") ||
    action.startsWith("PROMOTE_") ||
    action.startsWith("RECOVER_") ||
    action.startsWith("FIX_INGEST") ||
    action.startsWith("SPLIT_") ||
    action.startsWith("ATTACH_") ||
    action.startsWith("CLEAR_MISASSIGNED") ||
    action.startsWith("SCRIPT_") ||
    action.startsWith("SEED_") ||
    action === "IMPORT_QUESTIONS"
  ) {
    return "Import";
  }
  if (
    action.includes("QUESTION") ||
    action.includes("PRACTICE_SET") ||
    action.includes("FULL_PRACTICE_TEST") ||
    action.includes("STUDY_MATERIAL") ||
    action.includes("SUBSKILL") ||
    action.includes("TAXONOMY")
  ) {
    return "Content";
  }
  if (action.includes("PROGRAM") || action.includes("ENROLLMENT") || action.includes("GROUP")) {
    return "Programs";
  }
  if (action.includes("SETTING") || action.includes("MISTRAL") || action.includes("SMTP")) {
    return "Other";
  }
  return "Other";
}

export function parseAuditMetadata(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function formatAuditPayload(raw: string | null | undefined): string {
  const parsed = parseAuditMetadata(raw);
  if (parsed == null) return "";
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
}

export function outcomeFromMetadata(raw: string | null | undefined): "success" | "failure" | "info" | null {
  const parsed = parseAuditMetadata(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const outcome = (parsed as Record<string, unknown>).outcome;
  if (outcome === "success" || outcome === "failure" || outcome === "info") return outcome;
  return null;
}
