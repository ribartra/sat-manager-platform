"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { MathContent } from "@/components/math-content";
import { ImportQuestionnaireButton } from "@/components/import-questionnaire-button";
import { TaxonomyPicker } from "@/components/taxonomy-picker";

interface TopicInfo {
  id: string;
  name: string;
  domainName: string;
  sectionLabel: string;
  taxonomyLabel: string;
}

interface QuestionInfo {
  id: string;
  stem: string;
  topicId: string;
  difficulty: string;
  type: string;
  status: string;
}

interface PracticeSetInitial {
  id?: string;
  name?: string;
  topicId?: string;
  difficulty?: string;
  status?: string;
  explanationVisibility?: string;
  questionIds?: string[];
}

function plainMathLabel(content: string, maxLength: number) {
  const label = content
    .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
    .replace(/\\\[([\s\S]+?)\\\]/g, "$1")
    .replace(/\$([^$\n]+?)\$/g, "$1")
    .replace(/\\\(([\s\S]+?)\\\)/g, "$1");
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
}

export function PracticeSetEditor({
  topics,
  questions,
  initial,
}: {
  topics: TopicInfo[];
  questions: QuestionInfo[];
  initial?: PracticeSetInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [topicId, setTopicId] = useState(initial?.topicId ?? topics[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "EASY");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [explanationVisibility, setExplanationVisibility] = useState(initial?.explanationVisibility ?? "AFTER_FINISH");
  const [questionIds, setQuestionIds] = useState<string[]>(initial?.questionIds ?? []);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");

  const availableQuestions = useMemo(
    () => questions.filter((q) => q.topicId === topicId && !questionIds.includes(q.id)),
    [questions, questionIds, topicId]
  );
  const visibleAvailableQuestions = useMemo(() => {
    const term = questionSearch.trim().toLowerCase();
    if (!term) return availableQuestions;
    return availableQuestions.filter((question) =>
      [question.difficulty, question.type, question.status, plainMathLabel(question.stem, 300)]
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [availableQuestions, questionSearch]);

  function moveQuestion(index: number, direction: -1 | 1) {
    const next = [...questionIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setQuestionIds(next);
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    const body = { name, topicId, difficulty, status, explanationVisibility, questionIds };
    const url = initial?.id ? `/api/practice-sets/${initial.id}` : "/api/practice-sets";
    const method = initial?.id ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setErrors(Array.isArray(payload?.errors) ? payload.errors : [payload?.error ?? "Unable to save Practice Set."]);
      return;
    }
    router.push(`/teacher/content/${topicId}`);
    router.refresh();
  }

  const selectedQuestions = questionIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is QuestionInfo => Boolean(q));
  const selectedTopic = topics.find((topic) => topic.id === topicId);

  return (
    <div className="space-y-6">
      <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">PDF/DOCX Import</p>
          <h2 className="text-sm font-semibold text-gray-900">Create a review batch for this Practice Set</h2>
          <p className="mt-1 text-xs text-gray-500">Upload the question file plus any answer or explanation files, then review extracted questions before promotion.</p>
        </div>
        <ImportQuestionnaireButton
          mode="PRACTICE_SET"
          defaultName={name || "Practice Set PDF import"}
          topicName={selectedTopic?.name}
          domainName={selectedTopic?.domainName}
          difficulty={difficulty}
        />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Linear Equations Easy #1" />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Skill</label>
          <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Difficulty</label>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="BLOCKED">Blocked</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Explanation visibility</label>
          <Select value={explanationVisibility} onChange={(e) => setExplanationVisibility(e.target.value)}>
            <option value="IMMEDIATE">Immediately</option>
            <option value="AFTER_FINISH">After finish</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
        </div>
      </div>

      <Card>
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Questions ({selectedQuestions.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {selectedQuestions.map((q, index) => (
            <div key={q.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 text-xs font-medium text-gray-400">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <MathContent content={q.stem} className="line-clamp-2 text-sm font-medium text-gray-900" />
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={q.difficulty === "EASY" ? "easy" : q.difficulty === "MEDIUM" ? "medium" : "hard"}>{q.difficulty}</Badge>
                  <Badge variant="default">{q.type}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                <ArrowUp size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => moveQuestion(index, 1)} disabled={index === selectedQuestions.length - 1}>
                <ArrowDown size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setQuestionIds((ids) => ids.filter((id) => id !== q.id))}>
                <X size={14} />
              </Button>
            </div>
          ))}
          {selectedQuestions.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-400">No questions selected.</div>}
        </div>
      </Card>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Add question</label>
        <Input
          value={questionSearch}
          onChange={(event) => setQuestionSearch(event.target.value)}
          placeholder="Search question..."
          className="mb-2 text-sm"
        />
        <Select value="" onChange={(e) => e.target.value && setQuestionIds((ids) => [...ids, e.target.value])}>
          <option value="">Select a published question...</option>
          {visibleAvailableQuestions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.difficulty} / {q.type} / {plainMathLabel(q.stem, 90)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-3">
        {errors.length > 0 && (
          <Card variant="danger" padding="sm" className="text-sm text-red-700">
            <p className="font-medium">Fix these issues before saving:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || !name || !topicId || questionIds.length === 0}>
          {saving ? "Saving..." : initial?.id ? "Save Practice Set" : "Create Practice Set"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
