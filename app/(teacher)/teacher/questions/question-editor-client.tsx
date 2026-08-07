"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sigma, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { QuestionMedia } from "@/components/question-media";
import { TaxonomyPicker } from "@/components/taxonomy-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TopicInfo {
  id: string;
  name: string;
  sectionLabel: string;
  domainName: string;
  taxonomyLabel: string;
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
  imageUrl?: string | null;
  supportsGraph?: boolean;
  correctAnswer?: string;
  status?: string;
  options?: { label: string; text: string; imageUrl?: string | null }[];
}

interface SourceContext {
  ingestCandidateId?: string;
  batchId?: string;
  sourceFileId?: string;
}

type FormulaTarget =
  | { kind: "stimulus"; label: string }
  | { kind: "stem"; label: string }
  | { kind: "explanation"; label: string }
  | { kind: "option"; label: string; optionLabel: string };

const formulaPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
const formulaExactPattern = /^(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))$/;

function convertPlainTextToLatex(value: string) {
  return value
    .trim()
    .replace(/^\$+|\$+$/g, "")
    .replace(/\bsqrt\s*\(([^)]+)\)/gi, "\\sqrt{$1}")
    .replace(/\b([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)\b/g, "\\frac{$1}{$2}")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/!=/g, "\\ne ")
    .replace(/\bpi\b/gi, "\\pi")
    .replace(/\btheta\b/gi, "\\theta")
    .replace(/\balpha\b/gi, "\\alpha")
    .replace(/\bbeta\b/gi, "\\beta")
    .replace(/\bdelta\b/gi, "\\Delta")
    .replace(/\*/g, "\\cdot ");
}

function wrapFormula(latex: string, displayMode: boolean) {
  const clean = latex.trim();
  return displayMode ? `$$${clean}$$` : `$${clean}$`;
}

function formulaLabel(formula: string) {
  return formula.replace(/^\$\$|\$\$$/g, "").replace(/^\$|\$$/g, "").replace(/^\\\[|\\\]$/g, "").replace(/^\\\(|\\\)$/g, "");
}

function isDisplayFormula(formula: string) {
  return (formula.startsWith("$$") && formula.endsWith("$$")) || (formula.startsWith("\\[") && formula.endsWith("\\]"));
}

function splitFormulaParts(content: string) {
  return content.split(formulaPattern).filter(Boolean);
}

export function QuestionEditor({ topics, initial, sourceContext }: { topics: TopicInfo[]; initial?: QuestionData; sourceContext?: SourceContext }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  // Subskill is hidden in the editor (unused in the source taxonomy); keep any
  // stored value so saving an existing question doesn't wipe it.
  const [subskillId] = useState(initial?.subskillId ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "EASY");
  const [type, setType] = useState(initial?.type ?? "MC");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [stimulus, setStimulus] = useState(initial?.stimulus ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [supportsGraph, setSupportsGraph] = useState(initial?.supportsGraph ?? false);
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
  const [preview, setPreview] = useState(Boolean(initial?.stem));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaTarget, setFormulaTarget] = useState<FormulaTarget | null>(null);
  const [formulaPlainText, setFormulaPlainText] = useState("");
  const [formulaLatex, setFormulaLatex] = useState("");
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(false);
  const [formulaOriginal, setFormulaOriginal] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState<Record<string, boolean>>({});

  const selectedTopic = useMemo(() => topics.find((topic) => topic.id === topicId), [topicId, topics]);
  const isMathQuestion = selectedTopic?.sectionLabel === "Mathematics";

  function updateOption(label: string, text: string) {
    setOptions((prev) => prev.map((o) => (o.label === label ? { ...o, text } : o)));
  }

  function updateOptionImage(label: string, imageUrl: string) {
    setOptions((prev) => prev.map((o) => (o.label === label ? { ...o, imageUrl } : o)));
  }

  function getTargetValue(target: FormulaTarget) {
    if (target.kind === "stem") return stem;
    if (target.kind === "stimulus") return stimulus;
    if (target.kind === "explanation") return explanation;
    return options.find((option) => option.label === target.optionLabel)?.text ?? "";
  }

  function setTargetValue(target: FormulaTarget, value: string) {
    if (target.kind === "stem") setStem(value);
    if (target.kind === "stimulus") setStimulus(value);
    if (target.kind === "explanation") setExplanation(value);
    if (target.kind === "option") updateOption(target.optionLabel, value);
  }

  function openFormulaModal(target: FormulaTarget) {
    setFormulaTarget(target);
    setFormulaPlainText("");
    setFormulaLatex("");
    setFormulaDisplayMode(false);
    setFormulaOriginal(null);
    setFormulaOpen(true);
  }

  function editFormula(target: FormulaTarget, formula: string) {
    setFormulaTarget(target);
    setFormulaPlainText("");
    setFormulaLatex(formulaLabel(formula));
    setFormulaDisplayMode(isDisplayFormula(formula));
    setFormulaOriginal(formula);
    setFormulaOpen(true);
  }

  function insertFormula() {
    if (!formulaTarget || !formulaLatex.trim()) return;
    const nextFormula = wrapFormula(formulaLatex, formulaDisplayMode);
    const current = getTargetValue(formulaTarget);
    if (formulaOriginal) {
      setTargetValue(formulaTarget, current.replace(formulaOriginal, nextFormula));
      setFormulaOpen(false);
      return;
    }
    const separator = current && !/\s$/.test(current) ? " " : "";
    setTargetValue(formulaTarget, `${current}${separator}${nextFormula}`);
    setFormulaOpen(false);
  }

  function deleteFormula(target: FormulaTarget, formula: string) {
    const current = getTargetValue(target);
    setTargetValue(target, current.replace(formula, "").replace(/\s{2,}/g, " ").trim());
  }

  function renderFormulaButton(target: FormulaTarget) {
    if (!isMathQuestion) return null;
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => openFormulaModal(target)}>
        <Sigma size={14} />
        Formula
      </Button>
    );
  }

  function targetKey(target: FormulaTarget) {
    return target.kind === "option" ? `${target.kind}-${target.optionLabel}` : target.kind;
  }

  function renderVisualMathField({
    target,
    value,
    onChange,
    rows,
    placeholder,
  }: {
    target: FormulaTarget;
    value: string;
    onChange: (value: string) => void;
    rows: number;
    placeholder: string;
  }) {
    const hasFormula = isMathQuestion && formulaExactPattern.test(value.split(formulaPattern).find((part) => formulaExactPattern.test(part)) ?? "");
    const key = targetKey(target);
    const showSource = sourceOpen[key] ?? !hasFormula;

    if (!hasFormula) {
      return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />;
    }

    return (
      <div className="space-y-2">
        <div className="min-h-20 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {splitFormulaParts(value).map((part, index) => {
              const isFormula = formulaExactPattern.test(part);
              if (!isFormula) {
                return (
                  <span key={`${part}-${index}`} className="whitespace-pre-wrap text-gray-800">
                    {part}
                  </span>
                );
              }
              return (
                <span
                  key={`${part}-${index}`}
                  className="group inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-gray-900"
                >
                  <MathContent content={part} className="text-sm" />
                  <span className="ml-1 hidden items-center gap-0.5 group-hover:inline-flex">
                    <button
                      type="button"
                      onClick={() => editFormula(target, part)}
                      className="rounded p-1 text-gray-400 hover:bg-white hover:text-blue-700"
                      aria-label={`Edit formula ${formulaLabel(part)}`}
                      title="Edit formula"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFormula(target, part)}
                      className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600"
                      aria-label={`Delete formula ${formulaLabel(part)}`}
                      title="Delete formula"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSourceOpen((prev) => ({ ...prev, [key]: !showSource }))}
          className="text-xs font-medium text-blue-700 hover:underline"
        >
          {showSource ? "Hide source text" : "Edit source text"}
        </button>
        {showSource && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="font-mono text-xs"
          />
        )}
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    setErrors([]);
    const body = {
      topicId,
      subskillId: subskillId || null,
      difficulty,
      type,
      stem,
      stimulus,
      explanation,
      imageUrl,
      supportsGraph: isMathQuestion && supportsGraph,
      correctAnswer,
      status,
      options: type === "MC" ? options : [],
      ingestCandidateId: sourceContext?.ingestCandidateId,
    };
    const url = initial?.id ? `/api/questions/${initial.id}` : "/api/questions";
    const method = initial?.id ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setErrors(Array.isArray(payload?.errors) ? payload.errors : [payload?.error ?? "Unable to save question."]);
      return;
    }
    router.push("/teacher/questions");
  }

  return (
    <div className="space-y-6">
      {/* Skill + Metadata */}
      <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} required />

      <div className="max-w-xs">
        <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </Select>
      </div>

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

      {isMathQuestion && (
        <Card as="label" padding="sm" className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={supportsGraph}
            onChange={(event) => setSupportsGraph(event.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <span>
            <span className="block text-sm font-medium text-gray-800">Enable graph visualization</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Use this only when the question should preload graph data into the calculator or local renderer.
            </span>
          </span>
        </Card>
      )}

      {/* Stimulus */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">Stimulus / Passage (optional)</label>
          {renderFormulaButton({ kind: "stimulus", label: "Stimulus / Passage" })}
        </div>
        <p className="text-xs text-gray-400 mb-1">
          {isMathQuestion ? "Use the Formula button to insert rendered math." : "Will appear in left column of player."}
        </p>
        {renderVisualMathField({
          target: { kind: "stimulus", label: "Stimulus / Passage" },
          value: stimulus,
          onChange: setStimulus,
          rows: 4,
          placeholder: "Reading passage, graph description, or any context...",
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
        <Input
          value={imageUrl ?? ""}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Question stem */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">Question Stem *</label>
          {renderFormulaButton({ kind: "stem", label: "Question Stem" })}
        </div>
        {renderVisualMathField({
          target: { kind: "stem", label: "Question Stem" },
          value: stem,
          onChange: setStem,
          rows: 3,
          placeholder: "e.g. Which value of x satisfies...",
        })}
      </div>

      {/* Answer choices */}
      {type === "MC" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Answer Choices</label>
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt.label} className="grid grid-cols-[auto_1.5rem_1fr_auto] items-start gap-3">
                <input
                  type="radio"
                  name="correct"
                  value={opt.label}
                  checked={correctAnswer === opt.label}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="mt-3 text-blue-600"
                />
                <span className="mt-3 font-mono text-sm font-medium text-gray-600">{opt.label})</span>
                <div className="min-w-0 space-y-2">
                  {renderVisualMathField({
                    target: { kind: "option", label: `Option ${opt.label}`, optionLabel: opt.label },
                    value: opt.text,
                    onChange: (value) => updateOption(opt.label, value),
                    rows: 2,
                    placeholder: `Option ${opt.label}...`,
                  })}
                  <Input
                    value={opt.imageUrl ?? ""}
                    onChange={(e) => updateOptionImage(opt.label, e.target.value)}
                    placeholder={`Option ${opt.label} image URL (optional)`}
                    className="text-xs"
                  />
                  <QuestionMedia imageUrl={opt.imageUrl} className="bg-white" />
                </div>
                {renderFormulaButton({ kind: "option", label: `Option ${opt.label}`, optionLabel: opt.label })}
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
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">Explanation</label>
          {renderFormulaButton({ kind: "explanation", label: "Explanation" })}
        </div>
        {renderVisualMathField({
          target: { kind: "explanation", label: "Explanation" },
          value: explanation,
          onChange: setExplanation,
          rows: 3,
          placeholder: "Step-by-step solution...",
        })}
      </div>

      {/* Preview toggle */}
      {stem && (
        <Card variant="info" padding="md">
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
                <QuestionMedia imageUrl={imageUrl} className="mt-2 bg-white" />
              </div>
              {type === "MC" && options.some((option) => option.text.trim()) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Answer Choices</p>
                  <div className="space-y-2 rounded border bg-white p-3">
                    {options.map((option) => (
                      <div key={option.label} className="flex gap-2 text-sm text-gray-800">
                        <span className="w-5 shrink-0 font-medium">{option.label})</span>
                        <span className="min-w-0 flex-1">
                          {option.text ? <MathContent content={option.text} /> : <span className="text-gray-300">Empty</span>}
                          <QuestionMedia imageUrl={option.imageUrl} className="mt-2" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {explanation && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Explanation</p>
                  <MathContent content={explanation} className="text-sm text-gray-800 bg-white p-3 rounded border" />
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Fix these issues before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !stem || !topicId || !correctAnswer}>
          {saving ? "Saving..." : initial?.id ? "Update Question" : "Create Question"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>

      <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Insert Math Formula</DialogTitle>
            <DialogDescription>
              Convert plain math text into LaTeX, review the rendered output, then {formulaOriginal ? "update" : "insert"} it in {formulaTarget?.label ?? "the field"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Plain math text</label>
              <Textarea
                value={formulaPlainText}
                onChange={(event) => {
                  const next = event.target.value;
                  setFormulaPlainText(next);
                  setFormulaLatex(convertPlainTextToLatex(next));
                }}
                rows={6}
                placeholder="Examples: x^2 + 3x = 10, sqrt(x+1), 1/2, theta >= 30"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {["x^2 + 3x = 10", "sqrt(x+1)", "1/2", "theta >= 30", "y = mx + b"].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setFormulaPlainText(example);
                      setFormulaLatex(convertPlainTextToLatex(example));
                    }}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">LaTeX</label>
              <Textarea
                value={formulaLatex}
                onChange={(event) => setFormulaLatex(event.target.value)}
                rows={6}
                placeholder="LaTeX output..."
                className="font-mono text-sm"
              />
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formulaDisplayMode}
                  onChange={(event) => setFormulaDisplayMode(event.target.checked)}
                  className="rounded border-gray-300"
                />
                Display formula on its own line
              </label>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">Rendered preview</p>
            {formulaLatex.trim() ? (
              <MathContent content={wrapFormula(formulaLatex, formulaDisplayMode)} className="text-sm text-gray-900" />
            ) : (
              <p className="text-sm text-gray-400">Enter plain math text or LaTeX to preview it.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setFormulaOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={insertFormula} disabled={!formulaLatex.trim()}>
              <Sigma size={14} />
              {formulaOriginal ? "Update Formula" : "Insert Formula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
