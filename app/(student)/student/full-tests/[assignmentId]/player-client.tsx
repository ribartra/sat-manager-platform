"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { MathToolPanel } from "@/components/math-tool-panel";
import { QuestionMedia } from "@/components/question-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime, cn } from "@/lib/utils";
import type { CalculatorConfig } from "@/lib/calculator-config";
import type { GraphArtifact } from "@/lib/question-graph";
import type { FullTestProgressState, FullTestTimerPhase } from "@/lib/full-test-progress";
import { LoadingState, SaveIndicator, type SaveStatus } from "@/components/sat";
import { exitPlayerOnAuthLoss, isAuthFailureStatus } from "@/lib/player-session-exit";

interface ModuleQuestion {
  id: string;
  stem: string;
  stimulus: string | null;
  type: string;
  imageUrl?: string | null;
  options: { label: string; text: string; imageUrl?: string | null }[];
  graphArtifacts: GraphArtifact[];
}
interface TestModule {
  id: string;
  name: string;
  section: string;
  timeLimit: number;
  questions: ModuleQuestion[];
}

const RW_M2_INDEX = 1;

export function FullTestPlayer({
  attemptId,
  testName,
  modules,
  breakMinutes,
  savedAnswers,
  savedTimeSpent,
  savedModule,
  savedQuestion,
  savedExpiredEvents,
  savedExtraTimeUsed,
  savedProgressState,
  calculatorConfig,
}: {
  attemptId: string;
  assignmentId: string;
  testName: string;
  modules: TestModule[];
  breakMinutes: number;
  savedAnswers: Record<string, string>;
  savedTimeSpent: Record<string, number>;
  savedModule: number;
  savedQuestion: number;
  savedExpiredEvents: number;
  savedExtraTimeUsed: number;
  savedProgressState: FullTestProgressState | null;
  calculatorConfig: CalculatorConfig;
}) {
  const router = useRouter();
  const breakSecondsTotal = Math.max(0, breakMinutes) * 60;
  const initialTimers =
    savedProgressState?.timers?.length === modules.length
      ? savedProgressState.timers
      : modules.map((module) => module.timeLimit);
  const [phase, setPhase] = useState<FullTestTimerPhase>(savedProgressState?.phase === "BREAK" ? "BREAK" : "MODULE");
  const [breakRemaining, setBreakRemaining] = useState(
    savedProgressState?.phase === "BREAK" ? savedProgressState.breakRemaining : breakSecondsTotal,
  );
  const [moduleIndex, setModuleIndex] = useState(savedModule);
  const [questionIndex, setQuestionIndex] = useState(savedQuestion);
  const [remaining, setRemaining] = useState(initialTimers[savedModule] ?? modules[0]?.timeLimit ?? 0);
  const [expiredEvents, setExpiredEvents] = useState(savedExpiredEvents);
  const [extraTimeUsed] = useState(savedExtraTimeUsed);
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [saving, setSaving] = useState<SaveStatus>("idle");
  const [advancing, setAdvancing] = useState(false);
  const offlineKey = `sat-fpt-autosave:${attemptId}`;
  const currentModule = modules[moduleIndex];
  const question = currentModule?.questions[questionIndex];
  const expiredRecorded = useRef(false);
  const autoAdvanceTriggered = useRef(false);
  const timerState = useRef<number[]>(initialTimers);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });
  const phaseRef = useRef(phase);
  const breakRemainingRef = useRef(breakRemaining);
  const remainingRef = useRef(remaining);
  const moduleIndexRef = useRef(moduleIndex);
  const questionIndexRef = useRef(questionIndex);
  const answersRef = useRef(answers);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    breakRemainingRef.current = breakRemaining;
  }, [breakRemaining]);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);
  useEffect(() => {
    moduleIndexRef.current = moduleIndex;
  }, [moduleIndex]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionStartTime.current = Date.now();
    void (async () => {
      const response = await fetch(`/api/full-practice-tests/attempts/${attemptId}/resume`, { method: "POST" });
      if (isAuthFailureStatus(response.status)) {
        await exitPlayerOnAuthLoss({
          pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
        });
      }
    })();
  }, [attemptId]);

  const recordQuestionTime = useCallback(() => {
    const currentQuestion = modules[moduleIndexRef.current]?.questions[questionIndexRef.current];
    if (!currentQuestion || questionStartTime.current === null) return { ...timeSpentByQuestion.current };
    const now = Date.now();
    const delta = Math.max(0, Math.round((now - questionStartTime.current) / 1000));
    timeSpentByQuestion.current[currentQuestion.id] =
      (timeSpentByQuestion.current[currentQuestion.id] ?? 0) + delta;
    questionStartTime.current = now;
    return { ...timeSpentByQuestion.current };
  }, [modules]);

  const buildProgressPayload = useCallback(
    (overrides?: Partial<FullTestProgressState>): FullTestProgressState => ({
      timers: [...timerState.current],
      phase: overrides?.phase ?? phaseRef.current,
      breakRemaining: overrides?.breakRemaining ?? breakRemainingRef.current,
    }),
    [],
  );

  const saveProgress = useCallback(
    async (
      nextAnswers = answersRef.current,
      nextModule = moduleIndexRef.current,
      nextQuestion = questionIndexRef.current,
      progressOverrides?: Partial<FullTestProgressState>,
    ) => {
      if (phaseRef.current === "MODULE") {
        timerState.current[moduleIndexRef.current] = remainingRef.current;
      }
      const timeSpentSnapshot = recordQuestionTime();
      const moduleTimerState = buildProgressPayload(progressOverrides);
      const payload = {
        answers: nextAnswers,
        currentModule: nextModule,
        currentQuestion: nextQuestion,
        timeExpiredEvents: expiredEvents,
        extraTimeUsed,
        moduleTimerState,
        timeSpentByQuestion: timeSpentSnapshot,
      };
      setSaving("saving");
      try {
        const response = await fetch(`/api/full-practice-tests/attempts/${attemptId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (isAuthFailureStatus(response.status)) {
          await exitPlayerOnAuthLoss({
            pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
          });
          return;
        }
        if (!response.ok) throw new Error("Autosave failed");
        localStorage.removeItem(offlineKey);
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1500);
      } catch {
        localStorage.setItem(offlineKey, JSON.stringify(payload));
        setSaving("offline");
      }
    },
    [attemptId, buildProgressPayload, expiredEvents, extraTimeUsed, offlineKey, recordQuestionTime],
  );

  useEffect(() => {
    const syncOffline = async () => {
      const raw = localStorage.getItem(offlineKey);
      if (!raw) return;
      try {
        const response = await fetch(`/api/full-practice-tests/attempts/${attemptId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        });
        if (isAuthFailureStatus(response.status)) {
          await exitPlayerOnAuthLoss({
            pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
          });
          return;
        }
        if (response.ok) {
          localStorage.removeItem(offlineKey);
          setSaving("saved");
          setTimeout(() => setSaving("idle"), 1500);
        }
      } catch {
        setSaving("offline");
      }
    };
    window.addEventListener("online", syncOffline);
    void syncOffline();
    return () => window.removeEventListener("online", syncOffline);
  }, [attemptId, offlineKey]);

  const submit = useCallback(async () => {
    if (phaseRef.current === "MODULE") {
      timerState.current[moduleIndexRef.current] = remainingRef.current;
    }
    const timeSpentSnapshot = recordQuestionTime();
    const response = await fetch(`/api/full-practice-tests/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: answersRef.current,
        timeSpentByQuestion: timeSpentSnapshot,
        timeExpiredEvents: expiredEvents,
        extraTimeUsed,
      }),
    });
    if (isAuthFailureStatus(response.status)) {
      await exitPlayerOnAuthLoss({
        pauseUrl: `/api/full-practice-tests/attempts/${attemptId}/pause`,
      });
      return;
    }
    router.push(`/student/full-tests/results/${attemptId}`);
  }, [attemptId, expiredEvents, extraTimeUsed, recordQuestionTime, router]);

  const enterModule = useCallback(
    async (nextModule: number) => {
      setPhase("MODULE");
      setBreakRemaining(0);
      setModuleIndex(nextModule);
      setQuestionIndex(0);
      expiredRecorded.current = false;
      autoAdvanceTriggered.current = false;
      const nextRemaining = timerState.current[nextModule] ?? modules[nextModule].timeLimit;
      setRemaining(nextRemaining);
      remainingRef.current = nextRemaining;
      await saveProgress(answersRef.current, nextModule, 0, {
        phase: "MODULE",
        breakRemaining: 0,
      });
    },
    [modules, saveProgress],
  );

  const enterBreak = useCallback(async () => {
    setPhase("BREAK");
    setBreakRemaining(breakSecondsTotal);
    breakRemainingRef.current = breakSecondsTotal;
    autoAdvanceTriggered.current = false;
    await saveProgress(answersRef.current, moduleIndexRef.current, questionIndexRef.current, {
      phase: "BREAK",
      breakRemaining: breakSecondsTotal,
    });
  }, [breakSecondsTotal, saveProgress]);

  const advanceAfterModule = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const current = moduleIndexRef.current;
      timerState.current[current] = 0;
      if (current >= modules.length - 1) {
        await submit();
        return;
      }
      if (current === RW_M2_INDEX && breakSecondsTotal > 0) {
        await enterBreak();
        return;
      }
      await enterModule(current + 1);
    } finally {
      setAdvancing(false);
    }
  }, [advancing, breakSecondsTotal, enterBreak, enterModule, modules.length, submit]);

  // Module countdown — auto-advance at 0 (no playable extra time).
  useEffect(() => {
    if (phase !== "MODULE") return;
    const interval = setInterval(() => {
      setRemaining((time) => {
        if (time > 1) {
          timerState.current[moduleIndex] = time - 1;
          return time - 1;
        }
        if (time === 1) {
          if (!expiredRecorded.current) {
            expiredRecorded.current = true;
            setExpiredEvents((count) => count + 1);
          }
          timerState.current[moduleIndex] = 0;
          return 0;
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [moduleIndex, phase]);

  useEffect(() => {
    if (phase !== "MODULE" || remaining > 0 || autoAdvanceTriggered.current || advancing) return;
    autoAdvanceTriggered.current = true;
    void advanceAfterModule();
  }, [advanceAfterModule, advancing, phase, remaining]);

  // Break countdown — then enter Math M1.
  useEffect(() => {
    if (phase !== "BREAK") return;
    const interval = setInterval(() => {
      setBreakRemaining((time) => {
        if (time <= 1) return 0;
        return time - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "BREAK" || breakRemaining > 0 || autoAdvanceTriggered.current || advancing) return;
    autoAdvanceTriggered.current = true;
    void enterModule(RW_M2_INDEX + 1);
  }, [advancing, breakRemaining, enterModule, phase]);

  function next() {
    if (phase === "BREAK" || advancing) return;
    if (questionIndex < currentModule.questions.length - 1) {
      const nextQuestion = questionIndex + 1;
      setQuestionIndex(nextQuestion);
      void saveProgress(answers, moduleIndex, nextQuestion);
      return;
    }
    void advanceAfterModule();
  }

  const timerIsRed = phase === "MODULE" && remaining <= 60;

  if (phase === "BREAK") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white px-6">
        <p className="text-sm font-semibold text-gray-900">{testName}</p>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Break</h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          {breakMinutes}-minute break between Reading & Writing and Math. This time does not add to
          section clocks.
        </p>
        <p className={`mt-8 text-4xl font-semibold tabular-nums ${breakRemaining <= 60 ? "text-red-600" : "text-gray-900"}`}>
          {formatTime(breakRemaining)}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          {saving !== "idle" ? (
            <SaveIndicator status={saving} />
          ) : (
            "When the break ends you continue with Math Module 1."
          )}
        </p>
        <Button
          className="mt-8"
          variant="secondary"
          onClick={async () => {
            await saveProgress(answers, moduleIndex, questionIndex, {
              phase: "BREAK",
              breakRemaining,
            });
            await fetch(`/api/full-practice-tests/attempts/${attemptId}/pause`, { method: "POST" });
            router.push("/student/full-tests");
          }}
        >
          Pause & Exit
        </Button>
      </div>
    );
  }

  if (!question) {
    return <LoadingState className="h-screen" label="Loading…" />;
  }

  const hasPassage = Boolean(question.stimulus?.trim());

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{testName}</p>
          <p className="text-xs text-gray-500">
            {currentModule.name} · <span className="text-base font-bold text-gray-900">Question {questionIndex + 1}</span><span className="text-xs text-gray-500">/{currentModule.questions.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SaveIndicator status={saving} />
          <span className={`tabular-nums ${timerIsRed ? "text-red-600" : "text-gray-900"}`}>
            {formatTime(remaining)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await saveProgress();
              await fetch(`/api/full-practice-tests/attempts/${attemptId}/pause`, { method: "POST" });
              router.push("/student/full-tests");
            }}
          >
            Pause & Exit
          </Button>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div
          className={cn(
            "space-y-4 overflow-y-auto border-r border-gray-200 p-6",
            hasPassage && "bg-gray-50",
          )}
        >
          {hasPassage ? (
            <MathContent content={question.stimulus!} className="prose prose-base max-w-none text-gray-800" />
          ) : null}
          <div className={cn(hasPassage && "border-t border-gray-200 pt-4")}>
            <MathContent content={question.stem} className="text-base font-medium text-gray-900 md:text-lg" />
            <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${question.id} image`} className="mt-4" />
          </div>
        </div>
        <div className="overflow-y-auto p-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Answer choices</p>
          <MathToolPanel
            config={calculatorConfig}
            context="full-test"
            graphArtifacts={question.graphArtifacts}
            enabled={currentModule.section === "MATH"}
          />
          {question.type === "MC" ? (
            question.options.map((option) => (
              <button
                key={option.label}
                onClick={() => {
                  const nextAnswers = { ...answers, [question.id]: option.label };
                  setAnswers(nextAnswers);
                  void saveProgress(nextAnswers);
                }}
                className={`mb-2 block w-full rounded border px-4 py-3 text-left text-sm ${
                  answers[question.id] === option.label ? "border-blue-500 bg-blue-50" : "border-gray-200"
                }`}
              >
                <strong>{option.label})</strong> <MathContent content={option.text} />
                <QuestionMedia imageUrl={option.imageUrl} alt={`Option ${option.label} image`} className="mt-2" />
              </button>
            ))
          ) : (
            <Input
              value={answers[question.id] ?? ""}
              onChange={(e) => {
                const nextAnswers = { ...answers, [question.id]: e.target.value };
                setAnswers(nextAnswers);
                void saveProgress(nextAnswers);
              }}
              placeholder="Numeric answer"
            />
          )}
        </div>
      </div>
      <div className="flex justify-end border-t border-gray-200 px-6 py-3">
        <Button onClick={next} disabled={advancing}>
          {moduleIndex === modules.length - 1 && questionIndex === currentModule.questions.length - 1
            ? "Submit"
            : "Next"}
        </Button>
      </div>
    </div>
  );
}
