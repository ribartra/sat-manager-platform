"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Copy, Send, X } from "lucide-react";
import { QuestionListItem } from "@/components/question-list-item";
import { ImportQuestionnaireButton } from "@/components/import-questionnaire-button";
import { TaxonomyPicker } from "@/components/taxonomy-picker";
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
  difficultyBadgeVariant,
  difficultyLabel,
  difficultyOptions,
  explanationVisibilityOptions,
  practiceSetStatusOptions,
} from "@/lib/domain-meta";
import { validatePracticeSetPayload } from "@/lib/content-validation";
import {
  practiceSetEditorSchema,
  type PracticeSetEditorInput,
} from "@/contracts/practice-set";
import { apiFetch, readApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { Alert } from "@/components/sat/alert";

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
  imageUrl?: string | null;
  stimulus?: string | null;
  optionImageUrls?: string[];
}

interface PracticeSetInitial {
  id?: string;
  name?: string;
  topicId?: string;
  difficulty?: string;
  status?: string;
  explanationVisibility?: string;
  questionIds?: string[];
  assignmentCount?: number;
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
  const form = useForm<PracticeSetEditorInput>({
    resolver: zodResolver(practiceSetEditorSchema),
    defaultValues: {
      name: initial?.name ?? "",
      topicId: initial?.topicId ?? topics[0]?.id ?? "",
      difficulty: (initial?.difficulty as PracticeSetEditorInput["difficulty"]) ?? "EASY",
      status: (initial?.status as PracticeSetEditorInput["status"]) ?? "DRAFT",
      explanationVisibility:
        (initial?.explanationVisibility as PracticeSetEditorInput["explanationVisibility"]) ?? "AFTER_FINISH",
      questionIds: initial?.questionIds ?? [],
    },
  });

  const name = form.watch("name");
  const topicId = form.watch("topicId");
  const difficulty = form.watch("difficulty");
  const questionIds = form.watch("questionIds");

  const [errors, setErrors] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");

  const availableQuestions = useMemo(
    () => questions.filter((q) => q.topicId === topicId && !questionIds.includes(q.id)),
    [questions, questionIds, topicId],
  );
  const visibleAvailableQuestions = useMemo(() => {
    const term = questionSearch.trim().toLowerCase();
    if (!term) return availableQuestions;
    return availableQuestions.filter((question) =>
      [question.difficulty, question.type, question.status, plainMathLabel(question.stem, 300)].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [availableQuestions, questionSearch]);

  function setQuestionIds(next: string[] | ((prev: string[]) => string[])) {
    const resolved = typeof next === "function" ? next(form.getValues("questionIds")) : next;
    form.setValue("questionIds", resolved, { shouldDirty: true, shouldValidate: false });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const current = form.getValues("questionIds");
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestionIds(next);
  }

  async function onSubmit(values: PracticeSetEditorInput) {
    setErrors([]);
    const body = {
      name: values.name,
      topicId: values.topicId,
      difficulty: values.difficulty,
      status: values.status,
      explanationVisibility: values.explanationVisibility,
      questionIds: values.questionIds,
    };
    const url = initial?.id ? `/api/practice-sets/${initial.id}` : "/api/practice-sets";
    const method = initial?.id ? "PUT" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const error = await readApiError(response, "Unable to save Practice Set.");
      setErrors(error.details.length ? error.details : [error.message]);
      return;
    }
    router.push(`/teacher/content/${values.topicId}`);
    router.refresh();
  }

  function onInvalid() {
    setErrors(validatePracticeSetPayload(form.getValues()));
  }

  const selectedQuestions = questionIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is QuestionInfo => Boolean(q));
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const saving = form.formState.isSubmitting;
  const status = form.watch("status");
  const canAssign = status === "PUBLISHED" && Boolean(initial?.id);
  const [secondaryLoading, setSecondaryLoading] = useState<string | null>(null);

  async function duplicateSet() {
    if (!initial?.id) return;
    setSecondaryLoading("duplicate");
    let data: { practiceSet?: { id?: string } };
    try {
      data = await apiFetch(`/api/practice-sets/${initial.id}/duplicate`, { method: "POST", fallback: "Unable to duplicate." });
    } catch (error) {
      notify.error(error);
      return;
    } finally {
      setSecondaryLoading(null);
    }
    if (data?.practiceSet?.id) router.push(`/teacher/practice-sets/${data.practiceSet.id}/edit`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
        {initial?.id ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canAssign ? (
              <Button asChild variant="secondary" size="sm" type="button">
                <Link href={`/teacher?assignPracticeSet=${initial.id}`}>
                  <Send size={14} />
                  Assign
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" disabledReason="Publish the Practice Set before assigning.">
                <Send size={14} />
                Assign
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={duplicateSet}
              disabled={Boolean(secondaryLoading)}
            >
              <Copy size={14} />
              Duplicate
            </Button>
          </div>
        ) : null}

        <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400">PDF/DOCX Import</p>
            <h2 className="text-sm font-semibold text-gray-900">Create a review batch for this Practice Set</h2>
            <p className="mt-1 text-xs text-gray-500">
              Upload the question file plus any answer or explanation files, then review extracted questions before promotion.
            </p>
          </div>
          <ImportQuestionnaireButton
            mode="PRACTICE_SET"
            defaultName={name || "Practice Set PDF import"}
            topicName={selectedTopic?.name}
            domainName={selectedTopic?.domainName}
            difficulty={difficulty}
          />
        </Card>

        <FormSection title="Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Linear Equations Easy #1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-2">
              <FormField
                control={form.control}
                name="topicId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill</FormLabel>
                    <FormControl>
                      <TaxonomyPicker topics={topics} value={field.value} onChange={field.onChange} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                      {practiceSetStatusOptions().map((opt) => (
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
              name="explanationVisibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation visibility</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {explanationVisibilityOptions().map((opt) => (
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
        </FormSection>

        <Card>
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Questions ({selectedQuestions.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {selectedQuestions.map((q, index) => (
              <div key={q.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1 w-6 text-xs font-medium text-gray-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <QuestionListItem
                    question={q}
                    href={`/teacher/questions/${q.id}/edit`}
                    meta={
                      <>
                        <Badge variant={difficultyBadgeVariant(q.difficulty)}>{difficultyLabel(q.difficulty)}</Badge>
                        <Badge variant="default">{q.type}</Badge>
                      </>
                    }
                    stemClassName="font-medium text-gray-900"
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" aria-label={`Move question ${index + 1} up`} onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Move question ${index + 1} down`}
                  onClick={() => moveQuestion(index, 1)}
                  disabled={index === selectedQuestions.length - 1}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove question ${index + 1} from the set`}
                  onClick={() => setQuestionIds((ids) => ids.filter((id) => id !== q.id))}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            {selectedQuestions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No questions selected.</div>
            ) : null}
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

        {errors.length > 0 ? (
          <Alert tone="error" title="Fix these issues before saving:">
            <ul className="list-disc pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} disabledReason={!name?.trim() ? "Enter a name." : !topicId ? "Choose a skill." : questionIds.length === 0 ? "Add at least one question." : null}>
            {saving ? "Saving..." : initial?.id ? "Save Practice Set" : "Create Practice Set"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
