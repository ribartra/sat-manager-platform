"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { MathToolPanel } from "@/components/math-tool-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/utils";
import type { CalculatorConfig } from "@/lib/calculator-config";
import type { GraphArtifact } from "@/lib/question-graph";

interface ModuleQuestion { id: string; stem: string; stimulus: string | null; type: string; options: { label: string; text: string }[]; graphArtifacts: GraphArtifact[] }
interface TestModule { id: string; name: string; section: string; timeLimit: number; questions: ModuleQuestion[] }

export function FullTestPlayer({
  attemptId,
  testName,
  modules,
  savedAnswers,
  savedTimeSpent,
  savedModule,
  savedQuestion,
  savedExpiredEvents,
  savedExtraTimeUsed,
  savedTimerState,
  calculatorConfig,
}: {
  attemptId: string;
  assignmentId: string;
  testName: string;
  modules: TestModule[];
  savedAnswers: Record<string, string>;
  savedTimeSpent: Record<string, number>;
  savedModule: number;
  savedQuestion: number;
  savedExpiredEvents: number;
  savedExtraTimeUsed: number;
  savedTimerState: number[] | null;
  calculatorConfig: CalculatorConfig;
}) {
  const router = useRouter();
  const initialTimerState = savedTimerState?.length === modules.length ? savedTimerState : modules.map((module) => module.timeLimit);
  const [moduleIndex, setModuleIndex] = useState(savedModule);
  const [questionIndex, setQuestionIndex] = useState(savedQuestion);
  const [remaining, setRemaining] = useState(initialTimerState[savedModule] ?? modules[0]?.timeLimit ?? 0);
  const [expiredEvents, setExpiredEvents] = useState(savedExpiredEvents);
  const [extraTimeUsed, setExtraTimeUsed] = useState(savedExtraTimeUsed);
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const currentModule = modules[moduleIndex];
  const question = currentModule.questions[questionIndex];
  const expiredRecorded = useRef(false);
  const timerState = useRef<number[]>(initialTimerState);
  const questionStartTime = useRef<number | null>(null);
  const timeSpentByQuestion = useRef<Record<string, number>>({ ...savedTimeSpent });

  useEffect(() => {
    questionStartTime.current = Date.now();
  }, []);

  const recordQuestionTime = useCallback(() => {
    const currentQuestion = modules[moduleIndex]?.questions[questionIndex];
    if (!currentQuestion || questionStartTime.current === null) return { ...timeSpentByQuestion.current };
    const now = Date.now();
    const delta = Math.max(0, Math.round((now - questionStartTime.current) / 1000));
    timeSpentByQuestion.current[currentQuestion.id] = (timeSpentByQuestion.current[currentQuestion.id] ?? 0) + delta;
    questionStartTime.current = now;
    return { ...timeSpentByQuestion.current };
  }, [moduleIndex, modules, questionIndex]);

  useEffect(() => {
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
        setExtraTimeUsed((extra) => extra + 1);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [moduleIndex]);

  async function saveProgress(nextAnswers = answers, nextModule = moduleIndex, nextQuestion = questionIndex) {
    timerState.current[moduleIndex] = remaining;
    const timeSpentSnapshot = recordQuestionTime();
    setSaving("saving");
    await fetch(`/api/full-practice-tests/attempts/${attemptId}/autosave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: nextAnswers,
        currentModule: nextModule,
        currentQuestion: nextQuestion,
        timeExpiredEvents: expiredEvents,
        extraTimeUsed,
        moduleTimerState: timerState.current,
        timeSpentByQuestion: timeSpentSnapshot,
      }),
    });
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1500);
  }

  function next() {
    if (questionIndex < currentModule.questions.length - 1) {
      const nextQuestion = questionIndex + 1;
      setQuestionIndex(nextQuestion);
      void saveProgress(answers, moduleIndex, nextQuestion);
      return;
    }
    if (moduleIndex < modules.length - 1) {
      const nextModule = moduleIndex + 1;
      timerState.current[moduleIndex] = remaining;
      setModuleIndex(nextModule);
      setQuestionIndex(0);
      expiredRecorded.current = false;
      setRemaining(timerState.current[nextModule] ?? modules[nextModule].timeLimit);
      void saveProgress(answers, nextModule, 0);
      return;
    }
    submit();
  }

  async function submit() {
    timerState.current[moduleIndex] = remaining;
    const timeSpentSnapshot = recordQuestionTime();
    await fetch(`/api/full-practice-tests/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        timeSpentByQuestion: timeSpentSnapshot,
        timeExpiredEvents: expiredEvents,
        extraTimeUsed,
      }),
    });
    router.push(`/student/full-tests/results/${attemptId}`);
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div><p className="text-sm font-semibold text-gray-900">{testName}</p><p className="text-xs text-gray-500">{currentModule.name} · Question {questionIndex + 1}/{currentModule.questions.length}</p></div>
        <div className="flex items-center gap-4"><span className="text-xs text-gray-400">{saving === "saving" ? "Saving..." : saving === "saved" ? "Saved" : ""}</span><span className={remaining === 0 ? "text-red-600" : "text-gray-900"}>{remaining === 0 ? `Extra ${formatTime(extraTimeUsed)}` : formatTime(remaining)}</span><Button variant="secondary" size="sm" onClick={async () => { await saveProgress(); router.push("/student/full-tests"); }}>Pause & Exit</Button></div>
      </div>
      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        <div className="overflow-y-auto border-r border-gray-200 bg-gray-50 p-6">{question.stimulus ? <MathContent content={question.stimulus} /> : <p className="text-sm text-gray-400">No passage.</p>}</div>
        <div className="overflow-y-auto p-6">
          <MathToolPanel config={calculatorConfig} context="full-test" graphArtifacts={question.graphArtifacts} enabled={currentModule.section === "MATH"} />
          <MathContent content={question.stem} className="mb-5 text-sm text-gray-900" />
          {question.type === "MC" ? question.options.map((option) => (
            <button key={option.label} onClick={() => { const nextAnswers = { ...answers, [question.id]: option.label }; setAnswers(nextAnswers); void saveProgress(nextAnswers); }} className={`mb-2 block w-full rounded border px-4 py-3 text-left text-sm ${answers[question.id] === option.label ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <strong>{option.label})</strong> <MathContent content={option.text} />
            </button>
          )) : <Input value={answers[question.id] ?? ""} onChange={(e) => { const nextAnswers = { ...answers, [question.id]: e.target.value }; setAnswers(nextAnswers); void saveProgress(nextAnswers); }} placeholder="Numeric answer" />}
        </div>
      </div>
      <div className="flex justify-end border-t border-gray-200 px-6 py-3"><Button onClick={next}>{moduleIndex === modules.length - 1 && questionIndex === currentModule.questions.length - 1 ? "Submit" : "Next"}</Button></div>
    </div>
  );
}
