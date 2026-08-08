// Shared answer grading. A question's `correctAnswer` holds either a single
// value (MC letter like "C", or a numeric like "-3") or, for NUMERIC questions
// with several acceptable answers, a pipe-delimited set like "8|9" or "7|8|13".
// Grading accepts a student answer if it matches ANY accepted value.

const NUMERIC_EPSILON = 1e-9;

export function parseAccepted(correctAnswer: string | null | undefined): string[] {
  if (!correctAnswer) return [];
  return correctAnswer
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

// Parse an integer, decimal or simple fraction ("a/b") to a number, else NaN.
function toNumber(value: string): number {
  const trimmed = value.trim();
  const fraction = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return Number.NaN;
    return Number(fraction[1]) / denominator;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return Number.NaN;
}

export function isAnswerCorrect(
  studentAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
  type: string,
): boolean {
  const student = (studentAnswer ?? "").trim();
  if (!student) return false;
  const accepted = parseAccepted(correctAnswer);
  if (accepted.length === 0) return false;

  if (type === "NUMERIC") {
    const studentNum = toNumber(student);
    return accepted.some((value) => {
      if (value.toLowerCase() === student.toLowerCase()) return true;
      const acceptedNum = toNumber(value);
      return (
        !Number.isNaN(acceptedNum) &&
        !Number.isNaN(studentNum) &&
        Math.abs(acceptedNum - studentNum) < NUMERIC_EPSILON
      );
    });
  }

  const upper = student.toUpperCase();
  return accepted.some((value) => value.toUpperCase() === upper);
}

// Human-readable rendering of the correct answer(s), e.g. "8 o 9".
export function formatCorrectAnswer(correctAnswer: string | null | undefined): string {
  const parts = parseAccepted(correctAnswer);
  if (parts.length <= 1) return (correctAnswer ?? "").trim();
  return parts.join(" o ");
}
