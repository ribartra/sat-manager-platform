"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { MathContent } from "@/components/math-content";

interface TopicInfo {
  id: string;
  name: string;
  sectionLabel: string;
  domainName: string;
  subskills: { id: string; name: string }[];
}

interface QuestionData {
  id?: string;
  topicId?: string;
  subskillId?: string | null;
  difficulty?: string;
  type?: string;
  stem?: string;
  stimulus?: string;
  explanation?: string;
  correctAnswer?: string;
  status?: string;
  options?: { label: string; text: string }[];
}

export function QuestionEditor({ topics, initial }: { topics: TopicInfo[]; initial?: QuestionData }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  const [subskillId, setSubskillId] = useState(initial?.subskillId ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "EASY");
  const [type, setType] = useState(initial?.type ?? "MC");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [stimulus, setStimulus] = useState(initial?.stimulus ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correctAnswer ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [options, setOptions] = useState(
    initial?.options ?? [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ]
  );
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateOption(label: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.label === label ? { ...o, text } : o)));
  }

  async function handleSave() {
    setSaving(true);
    const body = { topicId, subskillId: subskillId || null, difficulty, type, stem, stimulus, explanation, correctAnswer, status, options: type === "MC" ? options : [] };
    const url = initial?.id ? `/api/questions/${initial.id}` : "/api/questions";
    const method = initial?.id ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    router.push("/teacher/questions");
  }

  return (
    <div className="space-y-6">
      {/* Topic + Metadata */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} required>
            <option value="">Select a topic...</option>
            {["Mathematics", "Reading & Writing"].map((section) => (
              <optgroup key={section} label={section}>
                {topics.filter((t) => t.sectionLabel === section).map((t) => (
                  <option key={t.id} value={t.id}>{t.domainName} / {t.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </Select>
        </div>
      </div>

      {topicId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subskill</label>
          <Select value={subskillId} onChange={(e) => setSubskillId(e.target.value)}>
            <option value="">No subskill</option>
            {topics.find((t) => t.id === topicId)?.subskills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="MC">Multiple Choice (A/B/C/D)</option>
            <option value="NUMERIC">Numeric Input</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </div>

      {/* Stimulus */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stimulus / Passage (optional)</label>
        <p className="text-xs text-gray-400 mb-1">Use $...$ for inline math. Will appear in left column of player.</p>
        <Textarea
          value={stimulus}
          onChange={(e) => setStimulus(e.target.value)}
          rows={4}
          placeholder="Reading passage, graph description, or any context..."
        />
      </div>

      {/* Question stem */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Question Stem *</label>
        <Textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          placeholder="e.g. Which value of $x$ satisfies..."
        />
      </div>

      {/* Answer choices */}
      {type === "MC" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Answer Choices</label>
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.label} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct"
                  value={opt.label}
                  checked={correctAnswer === opt.label}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="text-blue-600"
                />
                <span className="font-mono text-sm font-medium w-6 text-gray-600">{opt.label})</span>
                <Input
                  value={opt.text}
                  onChange={(e) => updateOption(opt.label, e.target.value)}
                  placeholder={`Option ${opt.label}...`}
                  className="flex-1"
                />
              </div>
            ))}
            <p className="text-xs text-gray-400">Select the radio button next to the correct answer.</p>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correct Numeric Answer</label>
          <Input
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            placeholder="e.g. 3 or 0.5"
            className="w-40"
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          placeholder="Step-by-step solution..."
        />
      </div>

      {/* Preview toggle */}
      {stem && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            {preview ? "Hide preview" : "Show rendered preview →"}
          </button>
          {preview && (
            <div className="mt-3 space-y-2">
              {stimulus && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Stimulus</p>
                  <MathContent content={stimulus} className="text-sm text-gray-800 bg-white p-3 rounded border" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Question</p>
                <MathContent content={stem} className="text-sm text-gray-800 bg-white p-3 rounded border" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !stem || !topicId || !correctAnswer}>
          {saving ? "Saving..." : initial?.id ? "Update Question" : "Create Question"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}
