-- Assignment-level practice feedback mode (TODO §13–15).
-- IMMEDIATE = Check per question; AFTER_SET = feedback only after submit.
ALTER TABLE "Assignment" ADD COLUMN "feedbackMode" TEXT NOT NULL DEFAULT 'AFTER_SET';
