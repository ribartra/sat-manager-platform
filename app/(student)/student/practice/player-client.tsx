"use client";

import { BLOCKED_SURFACE, SETTLED_RESULT } from "@/components/ui/control-states";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { MathToolPanel } from "@/components/math-tool-panel";
import { QuestionMedia } from "@/components/question-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/utils";
import type { CalculatorConfig } from "@/lib/calculator-config";
import type { GraphArtifact } from "@/lib/question-graph";
import { Flag, ChevronLeft, ChevronRight, List, Pause, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineBanner, SaveIndicator, type SaveStatus } from "@/components/sat";
import { clearBuffer, readBuffer, sendKeepalive, useOnlineStatus, usePageHideFlush, useSaveQueue, writeBuffer } from "@/lib/player-persistence";
import { exitPlayerOnAuthLoss, isAuthFailureStatus } from "@/lib/player-session-exit";
import { fetchWithTransientRetry } from "@/lib/transient-fetch";
import { errorMessage, readApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { formatCorrectAnswer, isAnswerCorrect } from "@/lib/answer-grading";
import type { CheckResult } from "@/lib/immediate-check";
import { questionResponseLabel, resolveQuestionType, isAnswerOption } from "@/lib/question-type";
import { Alert, InlineError } from "@/components/sat/alert";
import { KeyboardShortcutsHint, PlayerShortcuts } from "@/components/sat/keyboard-shortcuts-hint";

interface Option { label: string; text: string; imageUrl?: string | null }
interface Question {
  id: string;
  stem: string;
  stimulus: string | null;
  imageUrl: string | null;
  type: string;
  difficulty: string;
  options: Option[];
  graphArtifacts: GraphArtifact[];
  correctAnswer?: string | null;
  explanation?: string | null;
}
interface PlayerProps {
  practiceSetId: string;
  assignmentId: string | null;
  attemptId: string;
  questions: Question[];
  savedAnswers: Record<string, string>;
  savedMarked: string[];
  savedNotes: Record<string, string>;
  savedEliminated: Record<string, string[]>;
  /** Immediate feedback results for questions already checked (graded on the server). */
  savedChecks?: Record<string, CheckResult>;
  savedQuestion: number;
  savedTime: number;
  savedTimeSpent: Record<string, number>;
  setName: string;
  showCalculator: boolean;
  calculatorConfig: CalculatorConfig;
  feedbackMode?: "IMMEDIATE" | "AFTER_SET";
  previewMode?: boolean;
  exitHref?: string;
  resultHref?: string;
}

interface AutosavePayload {
  answers: Record<string, string>;
  currentQuestion: number;
  totalTime: number;
  timeSpentByQuestion: Record<string, number>;
  markedQuestionIds: string[];
  notes: Record<string, string>;
  eliminatedOptions: Record<string, string[]>;
}

function buildPayload(
  answers: Record<string, string>,
  currentQuestion: number,
  totalTime: number,
  marked: Set<string>,
  notes: Record<string, string>,
  eliminated: Record<string, Set<string>>,
  timeSpentByQuestion: Record<string, number>,
): AutosavePayload {
  return {
    answers,
    currentQuestion,
    totalTime,
    timeSpentByQuestion,
    markedQuestionIds: Array.from(marked),
    notes,
    eliminatedOptions: Object.fromEntries(Object.entries(eliminated).map(([id, labels]) => [id, Array.from(labels)])),
  };
}

export function PracticeSetPlayer({
  attemptId,
  questions,
  savedAnswers,
  savedMarked,
  savedNotes,
  savedEliminated,
  savedChecks = {},
  savedQuestion,
  savedTime,
  savedTimeSpent,
  setName,
  showCalculator,
  calculatorConfig,
  feedbackMode = "AFTER_SET",
  previewMode = false,
  exitHref = "/student/content-map",
  resultHref,
}: PlayerProps) {
  const router = useRouter();
  const immediateFeedback = feedbackMode === "IMMEDIATE";
  const [current, setCurrent] = useState(savedQuestion);
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [marked, setMarked] = useState<Set<string>>(new Set(savedMarked));
  const [notes, setNotes] = useState<Record<string, string>>(savedNotes);
  const [eliminated, setEliminated] = useState<Record<string, Set<string>>>(
    Object.fromEntries(Object.entries(savedEliminated).map(([id, labels]) => [id, new Set(labels)]))
  );
  const [checked, setChecked] = useState<Record<string, CheckResult>>(savedChecks);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [elapsed, setElapsed] = useState(savedTime);
  const [showNav, setShowNav] = useState(false);
  const [saving, setSaving] = useState<SaveStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });
  const enqueueSave = useSaveQueue();
  const confirm = useConfirm();
  const online = useOnlineStatus();

  const question = questions[current];
  const responseType = question ? resolveQuestionType(question.type, question.options) : "NUMERIC";
  const offlineKey = `sat-autosave:${attemptId}`;

  useEffect(() => {
    questionStartTime.current = Date.now();
    if (previewMode) return;
    void (async () => {
      const response = await fetchWithTransientRetry(`/api/attempts/${attemptId}/resume`, { method: "POST" });
      if (isAuthFailureStatus(response.status)) {
        await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
      }
    })();
  }, [attemptId, previewMode]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const recordCurrentQuestionTime = useCallback(() => {
    const currentQuestion = questions[current];
    if (!currentQuestion || questionStartTime.current === null) return { ...timeSpentByQuestion.current };

    const now = Date.now();
    const delta = Math.max(0, Math.round((now - questionStartTime.current) / 1000));
    timeSpentByQuestion.current[currentQuestion.id] = (timeSpentByQuestion.current[currentQuestion.id] ?? 0) + delta;
    questionStartTime.current = now;
    return { ...timeSpentByQuestion.current };
  }, [current, questions]);

  // Sends one payload through the save queue; on failure it stays in the local buffer.
  const postPayload = useCallback(
    (payload: AutosavePayload) =>
      enqueueSave(async () => {
        setSaving("saving");
        try {
          const response = await fetchWithTransientRetry(`/api/attempts/${attemptId}/autosave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (isAuthFailureStatus(response.status)) {
            await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
            return;
          }
          if (!response.ok) throw new Error("Autosave failed");
          clearBuffer(offlineKey);
          setSaving("saved");
          setTimeout(() => setSaving("idle"), 2000);
        } catch {
          writeBuffer(offlineKey, payload);
          setSaving("offline");
        }
      }),
    [attemptId, enqueueSave, offlineKey]
  );

  const saveProgress = useCallback(
    async (
      ans: Record<string, string>,
      qIndex: number,
      nextMarked = marked,
      nextNotes = notes,
      nextEliminated = eliminated,
    ) => {
      recordCurrentQuestionTime();
      if (previewMode) {
        setSaving("idle");
        return;
      }
      const payload = buildPayload(ans, qIndex, elapsed, nextMarked, nextNotes, nextEliminated, { ...timeSpentByQuestion.current });
      await postPayload(payload);
    },
    [elapsed, eliminated, marked, notes, postPayload, previewMode, recordCurrentQuestionTime]
  );

  // Latest full state, read by the reconnect sync and the page-hide flush.
  const latestPayload = useRef<AutosavePayload | null>(null);
  useEffect(() => {
    latestPayload.current = buildPayload(answers, current, elapsed, marked, notes, eliminated, { ...timeSpentByQuestion.current });
  });

  // On mount, a local buffer means the last save never reached the server: apply it to the
  // player state first (so the next autosave does not overwrite it), then send it.
  useEffect(() => {
    if (previewMode) return;
    void (async () => {
      await Promise.resolve();
      const buffered = readBuffer<AutosavePayload>(offlineKey);
      if (!buffered) return;
      const { savedAt: _savedAt, ...payload } = buffered;
      void _savedAt;
      setAnswers(payload.answers ?? {});
      setCurrent(Math.min(Math.max(payload.currentQuestion ?? 0, 0), Math.max(questions.length - 1, 0)));
      setElapsed((value) => Math.max(value, payload.totalTime ?? 0));
      setMarked(new Set(payload.markedQuestionIds ?? []));
      setNotes(payload.notes ?? {});
      setEliminated(Object.fromEntries(Object.entries(payload.eliminatedOptions ?? {}).map(([id, labels]) => [id, new Set(labels)])));
      for (const [id, seconds] of Object.entries(payload.timeSpentByQuestion ?? {})) {
        timeSpentByQuestion.current[id] = Math.max(timeSpentByQuestion.current[id] ?? 0, seconds);
      }
      await postPayload(payload);
    })();
  }, [offlineKey, postPayload, previewMode, questions.length]);

  // Back online: push the current state (it includes anything buffered while offline).
  useEffect(() => {
    if (previewMode) return;
    const onOnline = () => {
      if (latestPayload.current) void postPayload(latestPayload.current);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [postPayload, previewMode]);

  // Tab hidden or closed: cancel the pending debounce and save now.
  usePageHideFlush(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    recordCurrentQuestionTime();
    const payload = buildPayload(answers, current, elapsed, marked, notes, eliminated, { ...timeSpentByQuestion.current });
    writeBuffer(offlineKey, payload);
    sendKeepalive(`/api/attempts/${attemptId}/autosave`, payload);
  }, !previewMode);

  const handleAnswer = (questionId: string, value: string) => {
    if (checked[questionId]) return;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveProgress(newAnswers, current), 1500);
  };

  const handleCheck = async () => {
    if (!immediateFeedback || !question || checking) return;
    const selected = answers[question.id];
    if (!selected) return;
    setCheckError("");
    // Teacher preview grades locally (it already has the key); students are graded on the server.
    if (previewMode) {
      const key = question.correctAnswer ?? "";
      const ok = isAnswerCorrect(selected, key, resolveQuestionType(question.type, question.options));
      setChecked((prev) => ({
        ...prev,
        [question.id]: { isCorrect: ok, answerKey: key, correctAnswer: formatCorrectAnswer(key), explanation: question.explanation ?? null },
      }));
      return;
    }
    setChecking(true);
    try {
      const res = await fetchWithTransientRetry(`/api/attempts/${attemptId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer: selected }),
      });
      if (isAuthFailureStatus(res.status)) {
        await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
        return;
      }
      if (!res.ok) {
        setCheckError(errorMessage(await readApiError(res, "We couldn't check this answer. Please try again.")));
        return;
      }
      const data = (await res.json()) as CheckResult & { answer?: string };
      if (data.answer && data.answer !== selected) setAnswers((prev) => ({ ...prev, [question.id]: data.answer! }));
      setChecked((prev) => ({
        ...prev,
        [question.id]: { isCorrect: data.isCorrect, answerKey: data.answerKey, correctAnswer: data.correctAnswer, explanation: data.explanation },
      }));
    } catch {
      setCheckError("You're offline. Try again when you're back online.");
    } finally {
      setChecking(false);
    }
  };

  const handleNote = (questionId: string, value: string) => {
    const nextNotes = { ...notes, [questionId]: value };
    setNotes(nextNotes);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveProgress(answers, current, marked, nextNotes, eliminated), 1200);
  };

  const toggleMarked = (questionId: string) => {
    const next = new Set(marked);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    setMarked(next);
    void saveProgress(answers, current, next, notes, eliminated);
  };

  const toggleEliminated = (questionId: string, label: string) => {
    const currentLabels = new Set(eliminated[questionId] ?? []);
    if (currentLabels.has(label)) currentLabels.delete(label);
    else currentLabels.add(label);
    const nextEliminated = { ...eliminated, [questionId]: currentLabels };
    setEliminated(nextEliminated);
    void saveProgress(answers, current, marked, notes, nextEliminated);
  };

  const handleNavigate = async (idx: number) => {
    await saveProgress(answers, idx);
    setCurrent(idx);
    setShowNav(false);
  };

  const handlePauseExit = async () => {
    await saveProgress(answers, current);
    if (previewMode) {
      router.push(exitHref);
      return;
    }
    await fetch(`/api/attempts/${attemptId}/pause`, { method: "POST" });
    router.push(exitHref);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (previewMode) {
      notify.info("Preview", "Nothing is scored or saved.");
      router.push(exitHref);
      return;
    }
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    const confirmed = await confirm({
      title: "Submit this practice set?",
      description:
        unanswered > 0
          ? `You left ${unanswered} question${unanswered === 1 ? "" : "s"} blank. Blank questions count as wrong.`
          : "You'll see your results right after you submit.",
      confirmLabel: "Submit",
    });
    if (!confirmed) return;

    setSubmitting(true);
    const timeSpentSnapshot = recordCurrentQuestionTime();
    let response: Response;
    try {
      response = await fetchWithTransientRetry(`/api/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        totalTime: elapsed,
        timeSpentByQuestion: timeSpentSnapshot,
        markedQuestionIds: Array.from(marked),
        notes,
        eliminatedOptions: Object.fromEntries(Object.entries(eliminated).map(([id, labels]) => [id, Array.from(labels)])),
      }),
      });
    } catch {
      setSubmitting(false);
      notify.error("You're offline, so we couldn't submit. Your answers are safe — try again when you're back online.");
      return;
    }
    if (isAuthFailureStatus(response.status)) {
      await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
      return;
    }
    if (!response.ok) {
      setSubmitting(false);
      notify.error(await readApiError(response, "We couldn't submit. Your answers are safe — please try again."));
      return;
    }
    router.push(resultHref ?? `/student/results/${attemptId}`);
  };

  const timerColor =
    elapsed > 0 && elapsed < 300
      ? "text-gray-700"
      : elapsed < 600
      ? "text-yellow-600"
      : "text-red-600";

  const hasPassage = Boolean(question.stimulus?.trim());

  return (
    <>
      <PlayerShortcuts
        onPrevious={() => current > 0 && void handleNavigate(current - 1)}
        onNext={() => current < questions.length - 1 && void handleNavigate(current + 1)}
        onMark={() => toggleMarked(question.id)}
        onChoose={(label) => handleAnswer(question.id, label)}
        choiceLabels={
          responseType === "MC" && !checked[question.id]
            ? question.options.filter(isAnswerOption).map((opt) => opt.label)
            : []
        }
      />
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-white">
      {previewMode && (
        <Alert
          tone="warning"
          layout="banner"
          hideIcon
          className="py-2 text-sm"
          action={
            <button type="button" className="underline" onClick={() => router.push(exitHref)}>
              Exit preview
            </button>
          }
        >
          <span className="font-medium">Preview: nothing is scored or saved.</span>
        </Alert>
      )}
      <OfflineBanner online={online} />
      {/* Top bar — progress as x of N stays here; large question number lives with choices */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-medium text-gray-900 max-w-[12rem] sm:max-w-xs">{setName}</span>
          <span className="shrink-0 text-xs tabular-nums text-gray-500">
            {current + 1} of {questions.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 sm:block sm:w-32">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className={cn("font-mono text-sm font-medium", timerColor)}>
            {formatTime(elapsed)}
          </span>
          <SaveIndicator compact status={saving} />
        </div>
      </div>

      {/* Two-column player — left: stimulus + stem; right: alternatives */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* Left: stimulus + enunciado */}
        <div
          className={cn(
            "min-h-0 space-y-4 overflow-y-auto border-r border-gray-200 p-4 md:p-6",
            hasPassage && "bg-gray-50",
          )}
        >
          {hasPassage ? (
            <MathContent
              content={question.stimulus!}
              className="prose prose-base max-w-none leading-relaxed text-gray-800"
            />
          ) : null}
          <div className={cn(hasPassage && "border-t border-gray-200 pt-4")}>
            <MathContent
              content={question.stem}
              className="text-base font-medium leading-relaxed text-gray-900 md:text-lg"
            />
            <QuestionMedia imageUrl={question.imageUrl} alt={`Figure for question ${current + 1}`} className="mt-4" />
          </div>
        </div>

        {/* Right: alternatives — large Q number + taller choices */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold leading-none tabular-nums text-gray-900">{current + 1}</span>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{questionResponseLabel(responseType)}</p>
            </div>
            <div className="flex items-center gap-1">
              <KeyboardShortcutsHint choices={responseType === "MC"} />
              <button
                type="button"
                onClick={() => toggleMarked(question.id)}
                aria-pressed={marked.has(question.id)}
                className={cn(
                  "flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors",
                  marked.has(question.id)
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-gray-400 text-gray-700 hover:border-gray-500 hover:text-gray-900"
                )}
              >
                <Flag size={12} aria-hidden="true" />
                {marked.has(question.id) ? "Marked" : "Mark for review"}
              </button>
            </div>
          </div>
          <MathToolPanel config={calculatorConfig} context="practice-set" graphArtifacts={question.graphArtifacts} enabled={showCalculator} />

          {responseType === "MC" ? (
            <div className="space-y-2">
              {question.options.filter(isAnswerOption).map((opt) => {
                const isEliminated = eliminated[question.id]?.has(opt.label);
                const checkResult = checked[question.id];
                const selected = answers[question.id] === opt.label;
                const isCorrectChoice =
                  Boolean(checkResult) &&
                  isAnswerCorrect(opt.label, checkResult.answerKey, responseType);
                const isWrongSelected = Boolean(checkResult) && selected && !checkResult.isCorrect;
                return (
                <div
                  key={opt.label}
                  className={cn(
                    "flex min-h-[3.75rem] items-center gap-2 rounded-lg border px-3 py-4 text-sm transition-colors",
                    selected && !checkResult && "border-blue-500 bg-blue-50",
                    isCorrectChoice && "border-green-500 bg-green-50",
                    isWrongSelected && "border-red-500 bg-red-50",
                    !selected && !isCorrectChoice && "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    isEliminated && "opacity-55"
                  )}
                >
                <button
                  onClick={() => handleAnswer(question.id, opt.label)}
                  disabled={Boolean(checkResult)}
                  className={cn(
                    "flex flex-1 items-center gap-3 text-left",
                    isEliminated && "line-through",
                    // Checked answers are settled (read-only), not blocked: keep their colors.
                    SETTLED_RESULT
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      selected && !checkResult && "border-blue-500 bg-blue-500 text-white",
                      isCorrectChoice && "border-green-600 bg-green-600 text-white",
                      isWrongSelected && "border-red-600 bg-red-600 text-white",
                      !selected && !isCorrectChoice && "border-gray-300 text-gray-500"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} className="text-base leading-snug text-gray-800 md:text-[1.05rem]" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleEliminated(question.id, opt.label)}
                  disabled={Boolean(checkResult)}
                  className={cn("shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100", BLOCKED_SURFACE)}
                >
                  {isEliminated ? "Undo" : "Eliminate"}
                </button>
                </div>
              )})}
            </div>
          ) : (
            <div>
              <label htmlFor={`answer-${question.id}`} className="sr-only">Type your answer</label>
              <Input
                id={`answer-${question.id}`}
                type="text"
                value={answers[question.id] ?? ""}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                placeholder="Type your answer"
                className="w-40"
                disabled={Boolean(checked[question.id])}
              />
              <p className="mt-1 text-xs text-gray-400">You can type a fraction (1/2) or a decimal (0.5).</p>
            </div>
          )}

          {immediateFeedback && (
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {!checked[question.id] ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleCheck()}
                    disabled={checking} disabledReason={!answers[question.id] ? "Answer the question first." : null}
                  >
                    {checking ? "Checking…" : "Check"}
                  </Button>
                  <InlineError className="text-xs">{checkError}</InlineError>
                </>
              ) : (
                <>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      checked[question.id].isCorrect ? "text-green-700" : "text-red-700"
                    )}
                  >
                    {checked[question.id].isCorrect ? "Correct" : "Incorrect"}
                    {!checked[question.id].isCorrect && checked[question.id].correctAnswer
                      ? ` · Correct answer: ${checked[question.id].correctAnswer}`
                      : ""}
                  </p>
                  {checked[question.id].explanation?.trim() ? (
                    <div className="text-sm text-gray-700">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Explanation</p>
                      <MathContent content={checked[question.id].explanation!} />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          <details className="rounded-md border border-gray-200 bg-gray-50 open:bg-white">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-500">
              Personal note
            </summary>
            <div className="border-t border-gray-200 px-3 pb-3 pt-2">
              <Textarea
                value={notes[question.id] ?? ""}
                onChange={(e) => handleNote(question.id, e.target.value)}
                placeholder="A note just for you"
                rows={2}
              />
            </div>
          </details>
        </div>
      </div>

      {/* Bottom navigation — always visible in the player viewport */}
      <div className="z-10 flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-4 py-2.5 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => current > 0 && handleNavigate(current - 1)}
          disabled={current === 0}
        >
          <ChevronLeft size={16} className="mr-1" /> Back
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowNav(!showNav)}>
            <List size={14} className="mr-1" /> Questions
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePauseExit} title="The timer stops. You'll continue where you left off.">
            <Pause size={14} className="mr-1" /> Save & exit
          </Button>
        </div>

        {current < questions.length - 1 ? (
          <Button size="sm" onClick={() => handleNavigate(current + 1)}>
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Send size={14} className="mr-1" />
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>

      {/* Question navigator overlay — fixed so it never leaves a stuck inset block */}
      {showNav && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/20"
          role="dialog"
          aria-modal="true"
          aria-label="Question navigator"
          onClick={() => setShowNav(false)}
        >
          <div
            className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Questions</h3>
              <button type="button" aria-label="Close question navigator" onClick={() => setShowNav(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4 grid grid-cols-8 gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => handleNavigate(i)}
                  className={cn(
                    "h-9 w-9 rounded border text-xs font-medium transition-colors",
                    i === current
                      ? "border-blue-500 bg-blue-500 text-white"
                      : answers[q.id]
                      ? "border-green-400 bg-green-50 text-green-700"
                      : marked.has(q.id)
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-green-400 bg-green-100" /> Answered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-amber-400 bg-amber-50" /> Marked</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-white" /> Unanswered</span>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <Button variant="secondary" size="sm" onClick={handlePauseExit} className="w-full" title="The timer stops. You'll continue where you left off.">
                <Pause size={14} className="mr-1" /> Save & exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
