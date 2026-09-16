"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
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
import { SaveIndicator, type SaveStatus } from "@/components/sat";
import { exitPlayerOnAuthLoss, isAuthFailureStatus } from "@/lib/player-session-exit";
import { fetchWithTransientRetry } from "@/lib/transient-fetch";
import { isAnswerCorrect } from "@/lib/answer-grading";

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
  savedQuestion: number;
  savedTime: number;
  savedTimeSpent: Record<string, number>;
  setName: string;
  showCalculator: boolean;
  calculatorConfig: CalculatorConfig;
  feedbackMode?: "IMMEDIATE" | "AFTER_SET";
  previewMode?: boolean;
  exitHref?: string;
}

export function PracticeSetPlayer({
  attemptId,
  questions,
  savedAnswers,
  savedMarked,
  savedNotes,
  savedEliminated,
  savedQuestion,
  savedTime,
  savedTimeSpent,
  setName,
  showCalculator,
  calculatorConfig,
  feedbackMode = "AFTER_SET",
  previewMode = false,
  exitHref = "/teacher/practice-sets",
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
  const [checked, setChecked] = useState<Record<string, { isCorrect: boolean }>>({});
  const [elapsed, setElapsed] = useState(savedTime);
  const [showNav, setShowNav] = useState(false);
  const [saving, setSaving] = useState<SaveStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });

  const question = questions[current];
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
      const timeSpentSnapshot = { ...timeSpentByQuestion.current };
      const payload = {
        answers: ans,
        currentQuestion: qIndex,
        totalTime: elapsed,
        timeSpentByQuestion: timeSpentSnapshot,
        markedQuestionIds: Array.from(nextMarked),
        notes: nextNotes,
        eliminatedOptions: Object.fromEntries(
          Object.entries(nextEliminated).map(([id, labels]) => [id, Array.from(labels)])
        ),
      };
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
        localStorage.removeItem(offlineKey);
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch {
        localStorage.setItem(offlineKey, JSON.stringify(payload));
        setSaving("offline");
      }
    },
    [attemptId, elapsed, eliminated, marked, notes, offlineKey, previewMode, recordCurrentQuestionTime]
  );

  useEffect(() => {
    if (previewMode) return;
    const syncOffline = async () => {
      const raw = localStorage.getItem(offlineKey);
      if (!raw) return;
      try {
        const response = await fetchWithTransientRetry(`/api/attempts/${attemptId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });
        if (isAuthFailureStatus(response.status)) {
          await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
          return;
        }
        if (response.ok) {
          localStorage.removeItem(offlineKey);
          setSaving("saved");
          setTimeout(() => setSaving("idle"), 2000);
        }
      } catch {
        setSaving("offline");
      }
    };
    window.addEventListener("online", syncOffline);
    void syncOffline();
    return () => window.removeEventListener("online", syncOffline);
  }, [attemptId, offlineKey, previewMode]);

  const handleAnswer = (questionId: string, value: string) => {
    if (checked[questionId]) return;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveProgress(newAnswers, current), 1500);
  };

  const handleCheck = () => {
    if (!immediateFeedback || !question) return;
    const selected = answers[question.id];
    if (!selected) return;
    const ok = isAnswerCorrect(selected, question.correctAnswer, question.type);
    setChecked((prev) => ({ ...prev, [question.id]: { isCorrect: ok } }));
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
    router.push(`/student/content-map`);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (previewMode) {
      window.alert("Preview only — answers are not scored or saved.");
      router.push(exitHref);
      return;
    }
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    const confirmed = window.confirm(
      unanswered > 0
        ? `Submit this Practice Set with ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}? Blank answers will be marked as omitted.`
        : "Submit this Practice Set?"
    );
    if (!confirmed) return;

    setSubmitting(true);
    const timeSpentSnapshot = recordCurrentQuestionTime();
    const response = await fetchWithTransientRetry(`/api/attempts/${attemptId}/submit`, {
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
    if (isAuthFailureStatus(response.status)) {
      await exitPlayerOnAuthLoss({ pauseUrl: `/api/attempts/${attemptId}/pause` });
      return;
    }
    if (!response.ok) {
      setSubmitting(false);
      window.alert("Submit failed. Please try again.");
      return;
    }
    router.push(`/student/results/${attemptId}`);
  };

  const timerColor =
    elapsed > 0 && elapsed < 300
      ? "text-gray-700"
      : elapsed < 600
      ? "text-yellow-600"
      : "text-red-600";

  const hasPassage = Boolean(question.stimulus?.trim());

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-white">
      {previewMode && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
          <span className="font-medium">Preview only — not scored. No student attempt is created.</span>
          <button type="button" className="underline" onClick={() => router.push(exitHref)}>
            Exit preview
          </button>
        </div>
      )}
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
          <SaveIndicator className="hidden sm:inline" status={saving} />
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
            <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${current + 1} image`} className="mt-4" />
          </div>
        </div>

        {/* Right: alternatives — large Q number + taller choices */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold leading-none tabular-nums text-gray-900">{current + 1}</span>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Answer choices</p>
            </div>
            <button
              onClick={() => toggleMarked(question.id)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors",
                marked.has(question.id)
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-400 hover:border-gray-300"
              )}
            >
              <Flag size={12} />
              Mark
            </button>
          </div>
          <MathToolPanel config={calculatorConfig} context="practice-set" graphArtifacts={question.graphArtifacts} enabled={showCalculator} />

          {question.type === "MC" ? (
            <div className="space-y-2">
              {question.options.map((opt) => {
                const isEliminated = eliminated[question.id]?.has(opt.label);
                const checkResult = checked[question.id];
                const selected = answers[question.id] === opt.label;
                const isCorrectChoice =
                  Boolean(checkResult) &&
                  isAnswerCorrect(opt.label, question.correctAnswer, question.type);
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
                    checkResult && "cursor-default"
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
                    <MathContent content={opt.text} className="text-base leading-snug text-gray-800 md:text-[1.05rem]" />
                    <QuestionMedia imageUrl={opt.imageUrl} alt={`Option ${opt.label} image`} className="mt-2" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleEliminated(question.id, opt.label)}
                  disabled={Boolean(checkResult)}
                  className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                >
                  {isEliminated ? "Undo" : "Eliminate"}
                </button>
                </div>
              )})}
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Your answer</label>
              <Input
                type="text"
                value={answers[question.id] ?? ""}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                placeholder="Enter a number"
                className="w-40"
                disabled={Boolean(checked[question.id])}
              />
              <p className="mt-1 text-xs text-gray-400">For fractions, enter as decimal (e.g. 0.5)</p>
            </div>
          )}

          {immediateFeedback && (
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {!checked[question.id] ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCheck}
                  disabled={!answers[question.id]}
                >
                  Check
                </Button>
              ) : (
                <>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      checked[question.id].isCorrect ? "text-green-700" : "text-red-700"
                    )}
                  >
                    {checked[question.id].isCorrect ? "Correct" : "Incorrect"}
                    {!checked[question.id].isCorrect && question.correctAnswer
                      ? ` · Correct answer: ${question.correctAnswer}`
                      : ""}
                  </p>
                  {question.explanation?.trim() ? (
                    <div className="text-sm text-gray-700">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Explanation</p>
                      <MathContent content={question.explanation} />
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
                placeholder="Add a private note for review"
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
          <Button variant="secondary" size="sm" onClick={handlePauseExit}>
            <Pause size={14} className="mr-1" /> Pause & Exit
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
            {submitting ? "Submitting..." : "Submit"}
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
              <button type="button" onClick={() => setShowNav(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
              <Button variant="secondary" size="sm" onClick={handlePauseExit} className="w-full">
                <Pause size={14} className="mr-1" /> Pause & Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
