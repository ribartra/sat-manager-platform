-- RNF-10: sessions are invalidated when the password changes or the account is anonymized.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- RNF-11: immediate-feedback "Check" is graded on the server; a checked answer is locked.
ALTER TABLE "AttemptAnswer" ADD COLUMN "checkedAt" DATETIME;

-- RNF-6: indexes for the dashboard, history, reminder and question-bank queries.
CREATE INDEX IF NOT EXISTS "Assignment_status_dueDate_idx" ON "Assignment"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Assignment_locked_unlockAt_idx" ON "Assignment"("locked", "unlockAt");
CREATE INDEX IF NOT EXISTS "Attempt_studentId_status_idx" ON "Attempt"("studentId", "status");
CREATE INDEX IF NOT EXISTS "Attempt_assignmentId_idx" ON "Attempt"("assignmentId");
CREATE INDEX IF NOT EXISTS "Attempt_practiceSetId_idx" ON "Attempt"("practiceSetId");
CREATE INDEX IF NOT EXISTS "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetId_idx" ON "AuditLog"("targetId");
CREATE INDEX IF NOT EXISTS "FullPracticeTestAnswer_questionId_idx" ON "FullPracticeTestAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "FullPracticeTestAssignment_status_dueDate_idx" ON "FullPracticeTestAssignment"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "FullPracticeTestAttempt_studentId_status_idx" ON "FullPracticeTestAttempt"("studentId", "status");
CREATE INDEX IF NOT EXISTS "FullPracticeTestAttempt_assignmentId_idx" ON "FullPracticeTestAttempt"("assignmentId");
CREATE INDEX IF NOT EXISTS "FullPracticeTestAttempt_testId_idx" ON "FullPracticeTestAttempt"("testId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Question_topicId_difficulty_status_idx" ON "Question"("topicId", "difficulty", "status");
CREATE INDEX IF NOT EXISTS "Question_createdAt_idx" ON "Question"("createdAt");
