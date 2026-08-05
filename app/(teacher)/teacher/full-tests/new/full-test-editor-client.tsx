"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { ImportQuestionnaireButton } from "@/components/import-questionnaire-button";

const modules = ["Reading & Writing Module 1", "Reading & Writing Module 2", "Math Module 1", "Math Module 2"];
const expectedCounts = [27, 27, 22, 22];

export function FullTestEditor({
  questions,
  initial,
}: {
  questions: { id: string; label: string; stem: string; difficulty: string; section: string }[];
  initial?: {
    id?: string;
    name?: string;
    status?: string;
    reviewEnabled?: boolean;
    moduleQuestionIds?: string[][];
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [reviewEnabled, setReviewEnabled] = useState(initial?.reviewEnabled ?? true);
  const [moduleQuestionIds, setModuleQuestionIds] = useState<string[][]>(initial?.moduleQuestionIds ?? [[], [], [], []]);
  const [moduleSearches, setModuleSearches] = useState<string[]>(["", "", "", ""]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  function addQuestion(moduleIndex: number, questionId: string) {
    if (!questionId) return;
    setModuleQuestionIds((prev) => prev.map((ids, i) => i === moduleIndex && !ids.includes(questionId) ? [...ids, questionId] : ids));
  }

  function setModuleSearch(moduleIndex: number, value: string) {
    setModuleSearches((prev) => prev.map((search, index) => index === moduleIndex ? value : search));
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    setWarnings([]);
    const response = await fetch(initial?.id ? `/api/full-practice-tests/${initial.id}` : "/api/full-practice-tests", {
      method: initial?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, reviewEnabled, moduleQuestionIds }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setErrors(data?.errors ?? [data?.error ?? "Unable to create Exam."]);
      setWarnings(data?.warnings ?? []);
      return;
    }
    router.push("/teacher/full-tests");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">PDF/DOCX Import</p>
          <h2 className="text-sm font-semibold text-gray-900">Create a review batch for this Full Practice Test</h2>
          <p className="mt-1 text-xs text-gray-500">Upload all modules, answer keys and explanation files together so the engine can pair questions with answers before review.</p>
        </div>
        <ImportQuestionnaireButton mode="FULL_PRACTICE_TEST" defaultName={name || "Full Practice Test PDF import"} />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exam #1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={reviewEnabled} onChange={(event) => setReviewEnabled(event.target.checked)} />
          Show review after submit
        </label>
      </div>
      {modules.map((module, index) => {
        const section = index >= 2 ? "MATH" : "RW";
        const questionSearch = moduleSearches[index].trim().toLowerCase();
        const visibleQuestions = questions.filter((question) =>
          question.section === section &&
          (!questionSearch ||
            [question.label, question.stem, question.difficulty, question.section].some((value) => value.toLowerCase().includes(questionSearch)))
        );
        return (
          <Card key={module} padding="md">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{module}</h2>
              <span className={moduleQuestionIds[index].length === expectedCounts[index] ? "text-xs text-green-700" : "text-xs text-amber-700"}>
                {moduleQuestionIds[index].length}/{expectedCounts[index]} questions
              </span>
            </div>
            <Input
              value={moduleSearches[index]}
              onChange={(event) => setModuleSearch(index, event.target.value)}
              placeholder="Search question..."
              className="mb-2 text-sm"
            />
            <Select value="" onChange={(e) => addQuestion(index, e.target.value)}>
              <option value="">Add question...</option>
              {visibleQuestions.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
            </Select>
            <ul className="mt-3 space-y-1 text-xs text-gray-600">
              {moduleQuestionIds[index].map((id) => {
                const question = questions.find((q) => q.id === id);
                if (!question) return null;
                return (
                  <li key={id} className="rounded border border-gray-100 px-2 py-1">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase text-gray-400">
                      {question.section} · {question.difficulty}
                    </span>
                    <MathContent content={question.stem} className="line-clamp-2" />
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
      {warnings.length > 0 && (
        <Card variant="warning" padding="sm" className="text-sm text-amber-800">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </Card>
      )}
      {errors.length > 0 && (
        <Card variant="danger" padding="sm" className="text-sm text-red-700">
          <p className="font-medium">Fix these issues before saving:</p>
          <ul className="mt-1 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </Card>
      )}
      <Button onClick={save} disabled={saving || !name || moduleQuestionIds.some((ids) => ids.length === 0)}>{saving ? "Saving..." : initial?.id ? "Save Exam" : "Create Exam"}</Button>
    </div>
  );
}
