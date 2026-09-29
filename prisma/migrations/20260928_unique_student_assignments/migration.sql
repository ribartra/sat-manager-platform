-- Prevent the same student from receiving the same Practice Set or Full Practice Test twice.
CREATE UNIQUE INDEX "Assignment_studentId_practiceSetId_key"
ON "Assignment"("studentId", "practiceSetId");

CREATE UNIQUE INDEX "FullPracticeTestAssignment_studentId_testId_key"
ON "FullPracticeTestAssignment"("studentId", "testId");
