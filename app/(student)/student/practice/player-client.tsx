"use client";

import { SETTLED_RESULT } from "@/components/ui/control-states";
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
import { Calculator, ChevronLeft, ChevronRight, FileText, Flag, Highlighter, List as ListIcon, LogOut, Send } from "lucide-react";
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
import { EliminateIcon, ReferenceSheet, StrikeButton, ToolButton, useQuestionHighlights } from "@/components/sat/player-tools";
import { IssueReportButton } from "@/components/sat/issue-reporter";
import { Badge } from "@/components/ui/badge";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";

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
  /** Skill of the set, shown with each question (mockup take.js question header). */
  skillName?: string;
  /** Math set: shows the Calculator and Reference tools. */
  isMath?: boolean;
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
  skillName,
  isMath = false,
  showCalculator,
  calculatorConfig,
  feedbackMode = "AFTER_SET",
  previewMode = false,
  exitHref = "/student/practice",
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
  // "Check your work" page after the last question, before submitting (mockup take.js).
  const [reviewOpen, setReviewOpen] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  // Mockup take.js tools: Eliminate mode, calculator, reference sheet, question list.
  const [elimMode, setElimMode] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [listDifficulty, setListDifficulty] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [hlZone, setHlZone] = useState<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState<SaveStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });
  const enqueueSave = useSaveQueue();
  const confirm = useConfirm();
  const online = useOnlineStatus();

  const question = questions[current];
  const highlights = useQuestionHighlights(`sat.hl.practice.${attemptId}`, question?.id, hlZone);
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
    setReviewOpen(false);
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

  const blankCount = questions.filter((q) => !answers[q.id]).length;
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
        enabled={!reviewOpen && !showNav}
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
      {/* Top bar (mockup take.js): question list toggle + title, timer, tool buttons */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-[859px]:hidden">
            <ToolButton icon={<ListIcon size={18} />} label="Questions" active={listOpen} onClick={() => setListOpen((v) => !v)} title={listOpen ? "Hide question list" : "Show question list"} />
          </span>
          <div className="min-w-0">
            <p className="max-w-[12rem] truncate font-semibold text-[var(--sat-text)] sm:max-w-xs">{setName}</p>
            <p className="text-xs tabular-nums text-[var(--sat-muted)]">{current + 1} of {questions.length}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          {timerHidden ? (
            <button type="button" onClick={() => setTimerHidden(false)} className="text-xs font-medium text-gray-500 underline hover:text-gray-800">
              Show timer
            </button>
          ) : (
            <span className="flex flex-col items-center leading-tight">
              <span className={cn("text-xl font-extrabold tabular-nums", timerColor)}>{formatTime(elapsed)}</span>
              <button type="button" onClick={() => setTimerHidden(true)} className="text-xs text-gray-400 underline hover:text-gray-700">
                Hide
              </button>
            </span>
          )}
          <SaveIndicator compact status={saving} />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-0.5">
          <ToolButton icon={<Highlighter size={18} />} label="Highlight" onClick={highlights.highlightSelection} title="Highlight the selected text" />
          <ToolButton icon={<EliminateIcon />} label="Eliminate" active={elimMode} onClick={() => setElimMode((v) => !v)} />
          {isMath && showCalculator ? <ToolButton icon={<Calculator size={18} />} label="Calculator" active={calcOpen} onClick={() => setCalcOpen((v) => !v)} /> : null}
          {isMath ? <ToolButton icon={<FileText size={18} />} label="Reference" onClick={() => setRefOpen(true)} /> : null}
          <IssueReportButton variant="tool" />
          <ToolButton icon={<LogOut size={18} />} label="Save & exit" onClick={() => void handlePauseExit()} title="The timer stops. You'll continue where you left off." />
        </div>
      </div>
      <ReferenceSheet open={refOpen} onOpenChange={setRefOpen} />

      <div className="flex min-h-0 flex-1">
      {listOpen ? (
        <aside className="flex w-[230px] shrink-0 flex-col border-r border-gray-200 bg-white max-[859px]:hidden" aria-label="Question list">
          <div className="space-y-2 border-b border-gray-100 p-3">
            <p className="text-xs text-gray-600">
              <b className="text-gray-900">{questions.length - blankCount}</b> of {questions.length} answered
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${questions.length ? ((questions.length - blankCount) / questions.length) * 100 : 0}%` }} />
            </div>
            <div className="flex gap-1.5">
              <select aria-label="Filter by difficulty" value={listDifficulty} onChange={(e) => setListDifficulty(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 px-1 py-1 text-xs">
                <option value="">All levels</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
              <select aria-label="Filter by status" value={listStatus} onChange={(e) => setListStatus(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 px-1 py-1 text-xs">
                <option value="">All</option>
                <option value="open">Unanswered</option>
                <option value="answered">Answered</option>
                <option value="marked">Marked</option>
              </select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(() => {
              const rows = questions
                .map((q, i) => ({ q, i }))
                .filter(({ q }) => (!listDifficulty || q.difficulty === listDifficulty))
                .filter(({ q }) => (listStatus === "open" ? !answers[q.id] : listStatus === "answered" ? Boolean(answers[q.id]) : listStatus === "marked" ? marked.has(q.id) : true));
              if (rows.length === 0) return <p className="p-3 text-xs text-gray-500">No questions match.</p>;
              return rows.map(({ q, i }) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => void handleNavigate(i)}
                  aria-current={i === current && !reviewOpen ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-[var(--sat-surface-2)] px-3 py-[9px] text-left text-sm hover:bg-[var(--sat-surface-2)]",
                    i === current && !reviewOpen && "bg-[var(--sat-primary-soft)] shadow-[inset_3px_0_0_var(--sat-primary)]",
                  )}
                >
                  <b className="w-8 tabular-nums">Q{i + 1}</b>
                  <Badge variant={difficultyBadgeVariant(q.difficulty)}>{difficultyLabel(q.difficulty)}</Badge>
                  {marked.has(q.id) ? <Flag size={12} className="fill-red-500 text-red-500" aria-label="Marked" /> : null}
                  <span
                    aria-hidden
                    className={cn(
                      "ml-auto grid h-[18px] w-[18px] place-items-center rounded-full text-[9px]",
                      answers[q.id] ? "bg-[var(--sat-primary)] text-white" : "border-[1.5px] border-dashed border-[var(--sat-muted)]",
                    )}
                  >
                    {answers[q.id] ? "✓" : ""}
                  </span>
                </button>
              ));
            })()}
          </div>
        </aside>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

      {reviewOpen ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-semibold text-gray-900">Check your work</h2>
            <p className="mt-1 text-sm text-gray-600">
              {blankCount > 0 ? `${blankCount} question${blankCount === 1 ? " is" : "s are"} still unanswered. ` : "Every question has an answer. "}
              {marked.size > 0 ? `${marked.size} marked for review. ` : ""}
              Click a question to go back to it. When you are ready, submit the set.
            </p>
            <div className="mt-5 rounded-lg border border-gray-200 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">{setName}</p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                {questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => void handleNavigate(i)}
                    aria-label={`Question ${i + 1}${marked.has(q.id) ? ", marked for review" : ""}${answers[q.id] ? ", answered" : ", unanswered"}`}
                    className={cn(
                      "relative aspect-square rounded-lg border-[1.5px] text-sm font-bold",
                      answers[q.id]
                        ? "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white"
                        : "border-dashed border-[var(--sat-muted)] text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]",
                      marked.has(q.id) && "after:absolute after:-right-1.5 after:-top-2.5 after:text-[13px] after:text-[var(--sat-bad)] after:content-['⚑']",
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        {/* Left: stimulus + enunciado */}
        <div
          ref={setHlZone}
          className={cn(
            "min-h-0 space-y-4 overflow-y-auto border-[var(--sat-border)] p-4 max-md:border-b-[3px] md:border-r-[3px] md:px-[30px] md:py-[26px]",
          )}
        >
          {hasPassage ? (
            <MathContent
              content={question.stimulus!}
              className="prose prose-base max-w-none font-serif-q text-base leading-[1.7] text-[var(--sat-text)]"
            />
          ) : null}
          <div className={cn(hasPassage && "border-t border-[var(--sat-border)] pt-4")}>
            <MathContent
              content={question.stem}
              className="font-serif-q text-base leading-relaxed text-[var(--sat-text)] md:text-[17px]"
            />
            <QuestionMedia imageUrl={question.imageUrl} alt={`Figure for question ${current + 1}`} className="mt-4" />
          </div>
        </div>

        {/* Right: alternatives — large Q number + taller choices */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 md:px-[30px] md:py-[26px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-extrabold leading-none tabular-nums text-[var(--sat-text)]">{current + 1}</span>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{questionResponseLabel(responseType)}</p>
              <Badge variant={difficultyBadgeVariant(question.difficulty)}>{difficultyLabel(question.difficulty)}</Badge>
              {skillName ? <p className="hidden truncate text-xs text-gray-500 sm:block">{skillName}</p> : null}
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
          {calcOpen ? (
            <MathToolPanel config={calculatorConfig} context="practice-set" graphArtifacts={question.graphArtifacts} enabled={showCalculator} />
          ) : null}

          {responseType === "MC" ? (
            <div>
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
                    // Mockup `.choice`: Georgia 15px, 1.5px border, radius 10, 28px letter circle.
                    "mb-2.5 flex items-center gap-2 rounded-[10px] border-[1.5px] bg-white px-3.5 py-[11px] font-serif-q text-[15px] transition-colors",
                    selected && !checkResult && "border-[var(--sat-primary)] bg-[var(--sat-primary-soft)]",
                    isCorrectChoice && "border-[var(--sat-ok)] bg-[var(--sat-ok-soft)]",
                    isWrongSelected && "border-[var(--sat-bad)] bg-[var(--sat-bad-soft)]",
                    !selected && !isCorrectChoice && "border-[var(--sat-border-strong)] hover:border-[var(--sat-primary)]"
                  )}
                >
                <button
                  onClick={() => handleAnswer(question.id, opt.label)}
                  disabled={Boolean(checkResult)}
                  className={cn(
                    "flex flex-1 items-center gap-3 text-left",
                    isEliminated && "line-through opacity-45",
                    // Checked answers are settled (read-only), not blocked: keep their colors.
                    SETTLED_RESULT
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] font-sans text-xs font-bold",
                      selected && !checkResult && "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white",
                      isCorrectChoice && "border-[var(--sat-ok)] bg-[var(--sat-ok)] text-white",
                      isWrongSelected && "border-[var(--sat-bad)] bg-[var(--sat-bad)] text-white",
                      !selected && !isCorrectChoice && "border-[var(--sat-muted)] text-[var(--sat-text)]"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} className="text-[15px] leading-snug text-[var(--sat-text)]" />
                  </span>
                </button>
                {elimMode ? (
                  <StrikeButton
                    label={opt.label}
                    struck={Boolean(isEliminated)}
                    onClick={() => toggleEliminated(question.id, opt.label)}
                    disabled={Boolean(checkResult)}
                  />
                ) : null}
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

      )}

      </div>
      </div>

      {/* Bottom navigation (mockup `.take-foot`): saved note · question navigator · Back / Next */}
      <div className="z-10 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 sm:px-5">
        <span className="text-xs text-[var(--sat-muted)] max-[859px]:hidden">Your answers are saved automatically</span>
        <Button
          variant="secondary"
          className="col-start-2 border-0 bg-[var(--sat-text)] text-white hover:bg-[#1e293b]"
          onClick={() => setShowNav(!showNav)}
        >
          Question {current + 1} of {questions.length} ▴
        </Button>
        <div className="col-start-3 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => (reviewOpen ? setReviewOpen(false) : current > 0 && handleNavigate(current - 1))}
            disabled={!reviewOpen && current === 0}
          >
            <ChevronLeft size={16} className="max-sm:hidden" /> Back
          </Button>
          {current < questions.length - 1 && !reviewOpen ? (
            <Button onClick={() => handleNavigate(current + 1)}>
              Next <ChevronRight size={16} className="max-sm:hidden" />
            </Button>
          ) : !reviewOpen ? (
            <Button onClick={() => setReviewOpen(true)}>
              Review <ChevronRight size={16} className="max-sm:hidden" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[var(--sat-ok)] hover:bg-green-700">
              <Send size={14} />
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          )}
        </div>
      </div>

      {/* Question navigator overlay — fixed so it never leaves a stuck inset block */}
      {showNav && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center pb-[66px]"
          role="dialog"
          aria-modal="true"
          aria-label="Question navigator"
          onClick={() => setShowNav(false)}
        >
          <div
            className="w-[min(460px,94vw)] rounded-[14px] border border-[var(--sat-border)] bg-white p-4 shadow-[0_16px_40px_rgba(0,0,0,.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Questions</h3>
              <button type="button" aria-label="Close question navigator" onClick={() => setShowNav(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="mb-4 mt-2.5 grid grid-cols-8 gap-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => handleNavigate(i)}
                  className={cn(
                    // Mockup `.navgrid`: dashed when blank, blue when answered, outline on the current one, ⚑ when marked.
                    "relative aspect-square rounded-lg border-[1.5px] text-sm font-bold transition-colors",
                    answers[q.id]
                      ? "border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white"
                      : "border-dashed border-[var(--sat-muted)] bg-white text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]",
                    i === current && "outline-2 outline-offset-1 outline-[var(--sat-text)] outline",
                    marked.has(q.id) && "after:absolute after:-right-1.5 after:-top-2.5 after:text-[13px] after:text-[var(--sat-bad)] after:content-['⚑']"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--sat-muted)]">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-[var(--sat-primary)] bg-[var(--sat-primary)]" /> Answered</span>
              <span className="flex items-center gap-1"><span className="text-[var(--sat-bad)]">⚑</span> Marked</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-[var(--sat-muted)]" /> Unanswered</span>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setShowNav(false);
                  setReviewOpen(true);
                }}
              >
                Go to review page
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
