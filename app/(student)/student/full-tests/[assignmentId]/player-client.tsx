"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MathContent } from "@/components/math-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/utils";

interface ModuleQuestion { id: string; stem: string; stimulus: string | null; type: string; options: { label: string; text: string }[] }
interface TestModule { id: string; name: string; section: string; timeLimit: number; questions: ModuleQuestion[] }

export function FullTestPlayer({ attemptId, testName, modules }: { attemptId: string; assignmentId: string; testName: string; modules: TestModule[] }) {
  const router = useRouter();
  const [moduleIndex, setModuleIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remaining, setRemaining] = useState(modules[0]?.timeLimit ?? 0);
  const [expiredEvents, setExpiredEvents] = useState(0);
  const [extraTimeUsed, setExtraTimeUsed] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const currentModule = modules[moduleIndex];
  const question = currentModule.questions[questionIndex];
  const expiredRecorded = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((time) => {
        if (time > 1) return time - 1;
        if (time === 1) {
          if (!expiredRecorded.current) {
            expiredRecorded.current = true;
            setExpiredEvents((count) => count + 1);
          }
          return 0;
        }
        setExtraTimeUsed((extra) => extra + 1);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [moduleIndex]);

  function next() {
    if (questionIndex < currentModule.questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    if (moduleIndex < modules.length - 1) {
      const nextModule = moduleIndex + 1;
      setModuleIndex(nextModule);
      setQuestionIndex(0);
      expiredRecorded.current = false;
      setRemaining(modules[nextModule].timeLimit);
      return;
    }
    submit();
  }

  async function submit() {
    await fetch(`/api/full-practice-tests/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, timeExpiredEvents: expiredEvents, extraTimeUsed }),
    });
    router.push(`/student/full-tests/results/${attemptId}`);
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div><p className="text-sm font-semibold text-gray-900">{testName}</p><p className="text-xs text-gray-500">{currentModule.name} · Question {questionIndex + 1}/{currentModule.questions.length}</p></div>
        <div className="flex items-center gap-4"><span className={remaining === 0 ? "text-red-600" : "text-gray-900"}>{remaining === 0 ? `Extra ${formatTime(extraTimeUsed)}` : formatTime(remaining)}</span><Button variant="secondary" size="sm" onClick={() => router.push("/student/full-tests")}>Pause & Exit</Button></div>
      </div>
      <div className="grid flex-1 grid-cols-2 overflow-hidden">
        <div className="overflow-y-auto border-r border-gray-200 bg-gray-50 p-6">{question.stimulus ? <MathContent content={question.stimulus} /> : <p className="text-sm text-gray-400">No passage.</p>}</div>
        <div className="overflow-y-auto p-6">
          {currentModule.section === "MATH" && <iframe title="Desmos calculator" src="https://www.desmos.com/testing/sat/calculator" className="mb-4 h-64 w-full rounded border border-gray-200" />}
          <MathContent content={question.stem} className="mb-5 text-sm text-gray-900" />
          {question.type === "MC" ? question.options.map((option) => (
            <button key={option.label} onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.label }))} className={`mb-2 block w-full rounded border px-4 py-3 text-left text-sm ${answers[question.id] === option.label ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <strong>{option.label})</strong> <MathContent content={option.text} />
            </button>
          )) : <Input value={answers[question.id] ?? ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))} placeholder="Numeric answer" />}
        </div>
      </div>
      <div className="flex justify-end border-t border-gray-200 px-6 py-3"><Button onClick={next}>{moduleIndex === modules.length - 1 && questionIndex === currentModule.questions.length - 1 ? "Submit" : "Next"}</Button></div>
    </div>
  );
}
