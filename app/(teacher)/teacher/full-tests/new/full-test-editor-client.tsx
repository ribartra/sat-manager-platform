"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { QuestionListItem } from "@/components/question-list-item";
import { ImportQuestionnaireButton } from "@/components/import-questionnaire-button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/sat";
import { difficultyLabel, fullTestStatusOptions, humanizeCode, questionTypeLabel } from "@/lib/domain-meta";
import { FULL_TEST_MODULES } from "@/lib/full-test-modules";
import { validateFullPracticeTestStructure } from "@/lib/full-test-validation";
import {
  createFullTestEditorSchema,
  type FullTestEditorInput,
} from "@/contracts/full-test";
import { Alert } from "@/components/sat/alert";
import { readApiError } from "@/lib/api-client";

export function FullTestEditor({
  questions,
  initial,
}: {
  questions: {
    id: string;
    label: string;
    stem: string;
    difficulty: string;
    section: string;
    type?: string;
    imageUrl?: string | null;
    stimulus?: string | null;
    optionImageUrls?: string[];
  }[];
  initial?: {
    id?: string;
    name?: string;
    status?: string;
    reviewEnabled?: boolean;
    breakMinutes?: number;
    moduleQuestionIds?: string[][];
  };
}) {
  const router = useRouter();
  const questionSections = useMemo(
    () =>
      new Map(
        questions.map((question) => [
          question.id,
          question.section === "MATH" ? "MATH" : "RW",
        ]),
      ),
    [questions],
  );
  const schema = useMemo(() => createFullTestEditorSchema(questionSections), [questionSections]);

  const form = useForm<FullTestEditorInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      status: (initial?.status as FullTestEditorInput["status"]) ?? "DRAFT",
      reviewEnabled: initial?.reviewEnabled ?? true,
      breakMinutes: initial?.breakMinutes ?? 0,
      moduleQuestionIds: initial?.moduleQuestionIds ?? [[], [], [], []],
    },
  });

  const name = form.watch("name");
  const moduleQuestionIds = form.watch("moduleQuestionIds");

  const [moduleSearches, setModuleSearches] = useState<string[]>(["", "", "", ""]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  function setModuleQuestionIds(next: string[][]) {
    form.setValue("moduleQuestionIds", next, { shouldDirty: true, shouldValidate: false });
  }

  function addQuestion(moduleIndex: number, questionId: string) {
    if (!questionId) return;
    const current = form.getValues("moduleQuestionIds");
    setModuleQuestionIds(
      current.map((ids, i) => (i === moduleIndex && !ids.includes(questionId) ? [...ids, questionId] : ids)),
    );
  }

  function setModuleSearch(moduleIndex: number, value: string) {
    setModuleSearches((prev) => prev.map((search, index) => (index === moduleIndex ? value : search)));
  }

  async function onSubmit(values: FullTestEditorInput) {
    setErrors([]);
    setWarnings([]);
    const response = await fetch(initial?.id ? `/api/full-practice-tests/${initial.id}` : "/api/full-practice-tests", {
      method: initial?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        status: values.status,
        reviewEnabled: values.reviewEnabled,
        breakMinutes: values.breakMinutes,
        moduleQuestionIds: values.moduleQuestionIds,
      }),
    });
    if (!response.ok) {
      const error = await readApiError(response, "Unable to create Exam.");
      const warnings = (error.data as { warnings?: unknown } | null)?.warnings;
      setErrors(error.details.length ? error.details : [error.message]);
      setWarnings(Array.isArray(warnings) ? warnings.map(String) : []);
      return;
    }
    router.push("/teacher/practice-sets?area=tests");
    router.refresh();
  }

  function onInvalid() {
    const values = form.getValues();
    const validation = validateFullPracticeTestStructure({
      status: values.status,
      moduleQuestionIds: values.moduleQuestionIds,
      questionSections,
    });
    const fieldErrors: string[] = [];
    if (!values.name.trim()) fieldErrors.push("Name is required.");
    setErrors([...fieldErrors, ...validation.errors]);
    setWarnings(validation.warnings);
  }

  const saving = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-5" noValidate>
        <Card padding="md" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import questions from a file</h2>
            <p className="mt-1 text-xs text-gray-500">
              Upload the test and answer files. You&apos;ll check the questions before they&apos;re added.
            </p>
          </div>
          <ImportQuestionnaireButton mode="FULL_PRACTICE_TEST" defaultName={name || "Full Practice Test PDF import"} />
        </Card>

        <FormSection title="Exam settings">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input {...field} placeholder="Exam #1" />
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
                  <FormControl>
                    <Select {...field}>
                      {fullTestStatusOptions().map((opt) => (
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
              name="reviewEnabled"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <Checkbox
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                    Show answers after the exam
                  </label>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="breakMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Break R&amp;W → Math (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value}
                      onChange={(e) => field.onChange(Math.max(0, Number(e.target.value) || 0))}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <Card padding="sm" className="text-xs text-gray-600">
          <p className="font-medium text-gray-800">Exam layout (fixed)</p>
          <p className="mt-1">
            Same layout as the real SAT: 2 Reading &amp; Writing modules (32 min each) and 2 Math modules (35 min each).{" "}
            <Link className="text-blue-600 hover:underline" href="/teacher/full-tests/scoring">
              How scores are calculated
            </Link>
            .
          </p>
        </Card>

        {FULL_TEST_MODULES.map((module, index) => {
          const section = module.section;
          const moduleKey = module.moduleKey;
          const questionSearch = moduleSearches[index].trim().toLowerCase();
          const visibleQuestions = questions.filter(
            (question) =>
              question.section === section &&
              (!questionSearch ||
                [question.label, question.stem, question.difficulty, question.section].some((value) =>
                  value.toLowerCase().includes(questionSearch),
                )),
          );
          const count = moduleQuestionIds[index]?.length ?? 0;
          return (
            <Card key={module.name} padding="md">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{module.name}</h2>
                  <p className="text-xs text-gray-500">
                    Module {moduleKey === "M1" ? 1 : 2} ·{" "}
                    {Math.round(module.timeLimit / 60)} min
                  </p>
                </div>
                <span className={count === module.expectedCount ? "text-xs text-green-700" : "text-xs text-amber-700"}>
                  {count}/{module.expectedCount} questions
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
                {visibleQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </Select>
              <ul className="mt-3 space-y-2 text-xs text-gray-600">
                {(moduleQuestionIds[index] ?? []).map((id, qIndex) => {
                  const question = questions.find((q) => q.id === id);
                  if (!question) return null;
                  return (
                    <li key={id} className="rounded border border-gray-100 px-3 py-2">
                      <QuestionListItem
                        question={question}
                        href={`/teacher/questions/${question.id}/edit`}
                        indexLabel={<span className="text-xs font-medium text-gray-400">Q{qIndex + 1}</span>}
                        meta={
                          <>
                            <span className="text-[10px] font-medium uppercase text-gray-400">
                              {question.section === "MATH" ? "Math" : question.section === "RW" || question.section === "READING_WRITING" ? "Reading & Writing" : humanizeCode(question.section)} · {difficultyLabel(question.difficulty)}
                              {question.type ? ` · ${questionTypeLabel(question.type, true)}` : ""}
                            </span>
                          </>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}

        {warnings.length > 0 ? (
          <Alert tone="warning" title="Warnings">
            <ul className="list-disc pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {errors.length > 0 ? (
          <Alert tone="error" title="Fix these issues before saving:">
            <ul className="list-disc pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Button type="submit" disabled={saving} disabledReason={!name?.trim() ? "Enter a name." : !moduleQuestionIds.every((ids) => ids.length > 0) ? "Every module needs at least one question." : null}>
          {saving ? "Saving..." : initial?.id ? "Save Exam" : "Create Exam"}
        </Button>
      </form>
    </Form>
  );
}
