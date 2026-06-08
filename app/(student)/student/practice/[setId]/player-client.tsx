"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/utils";
import { Flag, ChevronLeft, ChevronRight, List, Pause, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option { label: string; text: string }
interface Question {
  id: string;
  stem: string;
  stimulus: string | null;
  type: string;
  difficulty: string;
  options: Option[];
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
}: PlayerProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(savedQuestion);
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [marked, setMarked] = useState<Set<string>>(new Set(savedMarked));
  const [notes, setNotes] = useState<Record<string, string>>(savedNotes);
  const [eliminated, setEliminated] = useState<Record<string, Set<string>>>(
    Object.fromEntries(Object.entries(savedEliminated).map(([id, labels]) => [id, new Set(labels)]))
  );
  const [elapsed, setElapsed] = useState(savedTime);
  const [showNav, setShowNav] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [submitting, setSubmitting] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });

  const question = questions[current];
  const offlineKey = `sat-autosave:${attemptId}`;

  useEffect(() => {
    questionStartTime.current = Date.now();
  }, []);

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
      const timeSpentSnapshot = recordCurrentQuestionTime();
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
        const response = await fetch(`/api/attempts/${attemptId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Autosave failed");
        localStorage.removeItem(offlineKey);
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 2000);
      } catch {
        localStorage.setItem(offlineKey, JSON.stringify(payload));
        setSaving("offline");
      }
    },
    [attemptId, elapsed, eliminated, marked, notes, offlineKey, recordCurrentQuestionTime]
  );

  useEffect(() => {
    const syncOffline = async () => {
      const raw = localStorage.getItem(offlineKey);
      if (!raw) return;
      try {
        const response = await fetch(`/api/attempts/${attemptId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });
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
  }, [attemptId, offlineKey]);

  const handleAnswer = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveProgress(newAnswers, current), 1500);
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
    router.push(`/student/content-map`);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const timeSpentSnapshot = recordCurrentQuestionTime();
    await fetch(`/api/attempts/${attemptId}/submit`, {
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
    router.push(`/student/results/${attemptId}`);
  };

  const timerColor =
    elapsed > 0 && elapsed < 300
      ? "text-gray-700"
      : elapsed < 600
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 bg-white">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{setName}</span>
          <span className="text-xs text-gray-500">
            Question {current + 1} of {questions.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-32 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className={cn("font-mono text-sm font-medium", timerColor)}>
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-gray-400">
            {saving === "saving" ? "Saving..." : saving === "saved" ? "Saved" : saving === "offline" ? "Saved offline" : ""}
          </span>
        </div>
      </div>

      {/* Two-column player */}
      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        {/* Left: stimulus */}
        <div className="overflow-y-auto p-6 border-r border-gray-200 bg-gray-50">
          {question.stimulus ? (
            <MathContent content={question.stimulus} className="prose prose-sm max-w-none text-gray-800 leading-relaxed" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm">
              No reading passage for this question
            </div>
          )}
        </div>

        {/* Right: question + answers */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6">
          {showCalculator && (
            <iframe title="Desmos calculator" src="https://www.desmos.com/testing/sat/calculator" className="h-64 w-full rounded border border-gray-200" />
          )}
          <div className="flex items-start justify-between gap-4">
            <MathContent
              content={question.stem}
              className="text-sm text-gray-900 leading-relaxed flex-1"
            />
            <button
              onClick={() => toggleMarked(question.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors",
                marked.has(question.id)
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-400 hover:border-gray-300"
              )}
            >
              <Flag size={12} />
              Mark
            </button>
          </div>

          {/* Answer choices */}
          {question.type === "MC" ? (
            <div className="space-y-2">
              {question.options.map((opt) => {
                const isEliminated = eliminated[question.id]?.has(opt.label);
                return (
                <div
                  key={opt.label}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-3 text-sm transition-colors",
                    answers[question.id] === opt.label
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    isEliminated && "opacity-55"
                  )}
                >
                <button
                  onClick={() => handleAnswer(question.id, opt.label)}
                  className={cn(
                    "flex flex-1 items-start gap-3 text-left",
                    isEliminated && "line-through"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                      answers[question.id] === opt.label
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 text-gray-500"
                    )}
                  >
                    {opt.label}
                  </span>
                  <MathContent content={opt.text} className="text-gray-800" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleEliminated(question.id, opt.label)}
                  className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  {isEliminated ? "Undo" : "Eliminate"}
                </button>
                </div>
              )})}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your answer</label>
              <Input
                type="text"
                value={answers[question.id] ?? ""}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                placeholder="Enter a number"
                className="w-40"
              />
              <p className="text-xs text-gray-400 mt-1">For fractions, enter as decimal (e.g. 0.5)</p>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="mb-1 block text-xs font-medium text-gray-500">Personal note</label>
            <Textarea
              value={notes[question.id] ?? ""}
              onChange={(e) => handleNote(question.id, e.target.value)}
              placeholder="Add a private note for review"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white">
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

      {/* Question navigator overlay */}
      {showNav && (
        <div className="absolute inset-0 bg-black/20 z-20 flex items-end justify-center">
          <div className="bg-white rounded-t-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Questions</h3>
              <button onClick={() => setShowNav(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="grid grid-cols-8 gap-2 mb-4">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => handleNavigate(i)}
                  className={cn(
                    "h-9 w-9 rounded text-xs font-medium border transition-colors",
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
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100 border border-green-400 inline-block" /> Answered</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-50 border border-amber-400 inline-block" /> Marked</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-white border border-gray-200 inline-block" /> Unanswered</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
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
