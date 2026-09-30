"use client";

import { Checkbox, Radio } from "@/components/ui/checkbox";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Copy, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { FormattedTextField } from "@/components/formatted-text-field";
import { QuestionImageField } from "@/components/question-image-field";
import { QuestionPlayerPreview } from "@/components/question-player-preview";
import { TaxonomyPicker } from "@/components/taxonomy-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/sat";
import {
  difficultyOptions,
  questionStatusOptions,
  questionTypeOptions,
} from "@/lib/domain-meta";
import { validateQuestionPayload } from "@/lib/content-validation";
import {
  DEFAULT_MC_OPTIONS,
  questionEditorSchema,
  type QuestionEditorInput,
} from "@/contracts/question";
import { resolveQuestionType } from "@/lib/question-type";

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

function normalizeOptions(options?: QuestionData["options"]) {
  if (!options?.length) {
    return DEFAULT_MC_OPTIONS.map((option) => ({ ...option }));
  }
  return options.map((option) => ({
    label: option.label,
    text: option.text ?? "",
    imageUrl: option.imageUrl ?? "",
  }));
}

export function QuestionEditor({
  topics,
  initial,
  sourceContext,
  showGraphOption = false,
}: {
  topics: TopicInfo[];
  initial?: QuestionData;
  sourceContext?: SourceContext;
  /** Admin feature flag: QUESTION_GRAPH_VISUALIZATION */
  showGraphOption?: boolean;
}) {
  const router = useRouter();
  // Subskill is hidden in the editor (unused in the source taxonomy); keep any
  // stored value so saving an existing question doesn't wipe it.
  const preservedSubskillId = initial?.subskillId ?? "";

  const form = useForm<QuestionEditorInput>({
    resolver: zodResolver(questionEditorSchema),
    defaultValues: {
      topicId: initial?.topicId ?? "",
      subskillId: preservedSubskillId || null,
      difficulty: (initial?.difficulty as QuestionEditorInput["difficulty"]) ?? "EASY",
      type: (initial?.type as QuestionEditorInput["type"]) ?? "MC",
      stem: initial?.stem ?? "",
      stimulus: initial?.stimulus ?? "",
      explanation: initial?.explanation ?? "",
      imageUrl: initial?.imageUrl ?? "",
      supportsGraph: initial?.supportsGraph ?? false,
      correctAnswer: initial?.correctAnswer ?? "",
      status: (initial?.status as QuestionEditorInput["status"]) ?? "DRAFT",
      options: normalizeOptions(initial?.options),
    },
  });

  const topicId = form.watch("topicId");
  const type = form.watch("type");
  const stem = form.watch("stem");
  const stimulus = form.watch("stimulus") ?? "";
  const explanation = form.watch("explanation") ?? "";
  const imageUrl = form.watch("imageUrl") ?? "";
  const supportsGraph = form.watch("supportsGraph") ?? false;
  const correctAnswer = form.watch("correctAnswer");
  const options = form.watch("options");
  const effectiveType = resolveQuestionType(type, options);
  const missingMultipleChoiceOptions = type === "MC" && effectiveType === "NUMERIC";

  const [preview, setPreview] = useState(Boolean(initial?.stem));
  const [errors, setErrors] = useState<string[]>([]);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaTarget, setFormulaTarget] = useState<FormulaTarget | null>(null);
  const [formulaPlainText, setFormulaPlainText] = useState("");
  const [formulaLatex, setFormulaLatex] = useState("");
  const [formulaDisplayMode, setFormulaDisplayMode] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const selectedTopic = useMemo(() => topics.find((topic) => topic.id === topicId), [topicId, topics]);
  const isMathQuestion = selectedTopic?.sectionLabel === "Mathematics";

  function bindFieldRef(key: string) {
    return (node: HTMLTextAreaElement | null) => {
      fieldRefs.current[key] = node;
    };
  }

  function updateOption(label: string, text: string) {
    const next = form.getValues("options").map((option) => (option.label === label ? { ...option, text } : option));
    form.setValue("options", next, { shouldDirty: true, shouldValidate: false });
  }

  function updateOptionImage(label: string, nextImageUrl: string) {
    const next = form.getValues("options").map((option) =>
      option.label === label ? { ...option, imageUrl: nextImageUrl } : option,
    );
    form.setValue("options", next, { shouldDirty: true, shouldValidate: false });
  }

  function getTargetValue(target: FormulaTarget) {
    if (target.kind === "stem") return form.getValues("stem");
    if (target.kind === "stimulus") return form.getValues("stimulus") ?? "";
    if (target.kind === "explanation") return form.getValues("explanation") ?? "";
    return form.getValues("options").find((option) => option.label === target.optionLabel)?.text ?? "";
  }

  function setTargetValue(target: FormulaTarget, value: string) {
    if (target.kind === "stem") form.setValue("stem", value, { shouldDirty: true });
    if (target.kind === "stimulus") form.setValue("stimulus", value, { shouldDirty: true });
    if (target.kind === "explanation") form.setValue("explanation", value, { shouldDirty: true });
    if (target.kind === "option") updateOption(target.optionLabel, value);
  }

  function openFormulaModal(target: FormulaTarget) {
    setFormulaTarget(target);
    setFormulaPlainText("");
    setFormulaLatex("");
    setFormulaDisplayMode(false);
    setFormulaOpen(true);
  }

  function insertFormula() {
    if (!formulaTarget || !formulaLatex.trim()) return;
    const nextFormula = wrapFormula(formulaLatex, formulaDisplayMode);
    const current = getTargetValue(formulaTarget);
    const separator = current && !/\s$/.test(current) ? " " : "";
    setTargetValue(formulaTarget, `${current}${separator}${nextFormula}`);
    setFormulaOpen(false);
  }

  function formulaToolbar(target: FormulaTarget) {
    if (!isMathQuestion) return null;
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => openFormulaModal(target)}>
        <Sigma size={14} />
        Formula
      </Button>
    );
  }

  async function onSubmit(values: QuestionEditorInput) {
    setErrors([]);
    const body = {
      topicId: values.topicId,
      subskillId: preservedSubskillId || null,
      difficulty: values.difficulty,
      type: values.type,
      stem: values.stem,
      stimulus: values.stimulus,
      explanation: values.explanation,
      imageUrl: values.imageUrl,
      supportsGraph: isMathQuestion && values.supportsGraph,
      correctAnswer: values.correctAnswer,
      status: values.status,
      options: values.type === "MC" ? values.options : [],
      ingestCandidateId: sourceContext?.ingestCandidateId,
    };
    const url = initial?.id ? `/api/questions/${initial.id}` : "/api/questions";
    const method = initial?.id ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setErrors(Array.isArray(payload?.errors) ? payload.errors : [payload?.error ?? "Unable to save question."]);
      return;
    }
    router.push("/teacher/questions");
  }

  function onInvalid() {
    setErrors(validateQuestionPayload(form.getValues()));
  }

  const saving = form.formState.isSubmitting;
  const canSave = Boolean(stem?.trim() && topicId && correctAnswer?.trim());
  const [duplicating, setDuplicating] = useState(false);

  async function duplicateQuestion() {
    if (!initial?.id) return;
    setDuplicating(true);
    const response = await fetch(`/api/questions/${initial.id}/duplicate`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setDuplicating(false);
    if (!response.ok) {
      window.alert(data.errors?.join("\n") || data.error || "Unable to duplicate.");
      return;
    }
    if (data?.question?.id) router.push(`/teacher/questions/${data.question.id}/edit`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
        {initial?.id ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={duplicateQuestion} disabled={duplicating}>
              <Copy size={14} />
              Duplicate
            </Button>
          </div>
        ) : null}
        <FormSection title="Classification">
          <FormField
            control={form.control}
            name="topicId"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <TaxonomyPicker topics={topics} value={field.value} onChange={field.onChange} required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="max-w-xs">
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {difficultyOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  {missingMultipleChoiceOptions ? (
                    <p className="text-xs text-amber-700">
                      Add at least two answer choices. Until then, the player uses a numeric answer field.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Type</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {questionTypeOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {questionStatusOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {isMathQuestion && showGraphOption ? (
            <FormField
              control={form.control}
              name="supportsGraph"
              render={({ field }) => (
                <FormItem>
                  <Card as="label" padding="sm" className="flex items-start gap-3">
                    <Checkbox
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      className="mt-1 rounded border-gray-300"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-800">Enable graph visualization</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Use this only when the question should preload graph data into the calculator or local renderer.
                      </span>
                    </span>
                  </Card>
                </FormItem>
              )}
            />
          ) : null}
        </FormSection>

        <FormSection title="Content">
          <FormattedTextField
            label="Stimulus / Passage (optional)"
            value={stimulus}
            onChange={(value) => form.setValue("stimulus", value, { shouldDirty: true })}
            rows={4}
            placeholder="Reading passage, graph description, or any context..."
            hint={
              isMathQuestion
                ? "Bold/Underline wrap selection; Formula inserts LaTeX."
                : "Select text then Bold/Underline. Appears in the left column of the player."
            }
            collapsible
            collapseLabel="Add passage"
            onInputRef={bindFieldRef("stimulus")}
            toolbarExtra={formulaToolbar({ kind: "stimulus", label: "Stimulus / Passage" })}
          />

          <QuestionImageField
            label="Question image (optional)"
            value={imageUrl}
            onChange={(next) => form.setValue("imageUrl", next, { shouldDirty: true })}
            placeholder="/uploads/questions/..."
          />

          <FormattedTextField
            label="Question Stem *"
            value={stem}
            onChange={(value) => form.setValue("stem", value, { shouldDirty: true })}
            rows={3}
            placeholder="e.g. Which value of x satisfies..."
            onInputRef={bindFieldRef("stem")}
            toolbarExtra={formulaToolbar({ kind: "stem", label: "Question Stem" })}
          />

          {type === "MC" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Answer Choices</label>
              <div className="space-y-3">
                {options.map((opt) => (
                  <div key={opt.label} className="grid grid-cols-[auto_1.5rem_1fr] items-start gap-3">
                    <Radio
                      name="correct"
                      value={opt.label}
                      checked={correctAnswer === opt.label}
                      onChange={(e) => form.setValue("correctAnswer", e.target.value, { shouldDirty: true })}
                      className="mt-8 text-blue-600"
                    />
                    <span className="mt-8 font-mono text-sm font-medium text-gray-600">{opt.label})</span>
                    <div className="min-w-0 space-y-2">
                      <FormattedTextField
                        label={`Option ${opt.label}`}
                        value={opt.text}
                        onChange={(value) => updateOption(opt.label, value)}
                        rows={2}
                        placeholder={`Option ${opt.label}...`}
                        onInputRef={bindFieldRef(`option-${opt.label}`)}
                        toolbarExtra={formulaToolbar({
                          kind: "option",
                          label: `Option ${opt.label}`,
                          optionLabel: opt.label,
                        })}
                      />
                      <QuestionImageField
                        label={`Option ${opt.label} image (optional)`}
                        value={opt.imageUrl ?? ""}
                        onChange={(next) => updateOptionImage(opt.label, next)}
                        placeholder="/uploads/questions/..."
                        compact
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400">Select the radio button next to the correct answer.</p>
              </div>
            </div>
          ) : (
            <FormField
              control={form.control}
              name="correctAnswer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correct Numeric Answer</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. 3 or 0.5" className="w-40" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormattedTextField
            label="Explanation"
            value={explanation}
            onChange={(value) => form.setValue("explanation", value, { shouldDirty: true })}
            rows={3}
            placeholder="Step-by-step solution..."
            onInputRef={bindFieldRef("explanation")}
            toolbarExtra={formulaToolbar({ kind: "explanation", label: "Explanation" })}
          />
        </FormSection>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPreview(!preview)}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              {preview ? "Hide player view" : "View as player →"}
            </button>
            {preview && explanation.trim() ? (
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer select-none text-xs font-medium text-gray-500 hover:text-gray-700">
                  Show explanation (teacher only)
                </summary>
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <MathContent content={explanation} className="text-sm text-gray-800" />
                </div>
              </details>
            ) : null}
          </div>
          {preview ? (
            <QuestionPlayerPreview
              stem={stem}
              stimulus={stimulus}
              imageUrl={imageUrl}
              type={type}
              options={options}
            />
          ) : null}
        </div>

        {errors.length > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Fix these issues before saving:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} disabledReason={!stem?.trim() ? "Write the question stem." : !topicId ? "Choose a skill." : !correctAnswer?.trim() ? "Set the correct answer." : null}>
            {saving ? "Saving..." : initial?.id ? "Update Question" : "Create Question"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Insert Math Formula</DialogTitle>
              <DialogDescription>
                Convert plain math text into LaTeX, review the rendered output, then insert it in{" "}
                {formulaTarget?.label ?? "the field"}.
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
                  <Checkbox
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
              <Button type="button" onClick={insertFormula} disabledReason={!formulaLatex.trim() ? "Type a formula first." : null}>
                <Sigma size={14} />
                Insert Formula
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
}
