"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { difficultyOptions } from "@/lib/domain-meta";

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

type ImportMode = "PRACTICE_SET" | "FULL_PRACTICE_TEST";
type AnswerTrayRole = "ANSWER" | "EXPLANATION" | "ANSWER_EXPLANATION";

type ImportQuestionnaireButtonProps = {
  mode: ImportMode;
  defaultName: string;
  topicName?: string;
  domainName?: string;
  difficulty?: string;
};

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTray({
  title,
  hint,
  required,
  files,
  disabled,
  onChange,
  children,
}: {
  title: string;
  hint: string;
  required?: boolean;
  files: File[];
  disabled?: boolean;
  onChange: (files: File[]) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {title}
          {required ? <span className="text-red-500"> *</span> : null}
        </p>
        <span className="text-xs text-gray-500">{files.length ? `${files.length} selected` : "No file"}</span>
      </div>
      <p className="mb-3 text-xs leading-5 text-gray-600">{hint}</p>
      {children}
      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border border-blue-300 bg-white px-4 py-5 text-center hover:bg-blue-50">
        <FileUp className="mb-2 h-5 w-5 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">Choose file</span>
        <span className="mt-1 text-xs text-gray-500">PDF or DOCX · max 256 MB total</span>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span className="min-w-0 truncate" title={file.name}>{file.name}</span>
              <span className="shrink-0 text-gray-400">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImportQuestionnaireButton({ mode, defaultName, topicName, domainName, difficulty }: ImportQuestionnaireButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty ?? "EASY");
  const [testNumber, setTestNumber] = useState("");
  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [answersIncludeExplanations, setAnswersIncludeExplanations] = useState(true);
  const [answerTrayKind, setAnswerTrayKind] = useState<"ANSWERS" | "EXPLANATIONS">("ANSWERS");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const allFiles = useMemo(() => [...questionFiles, ...answerFiles], [questionFiles, answerFiles]);
  const totalSize = useMemo(() => allFiles.reduce((sum, file) => sum + file.size, 0), [allFiles]);
  const oversized = totalSize > MAX_UPLOAD_BYTES;
  const modeLabel = mode === "PRACTICE_SET" ? "Practice Set" : "Full Practice Test";

  const answerRole: AnswerTrayRole = answersIncludeExplanations
    ? "ANSWER_EXPLANATION"
    : answerTrayKind === "EXPLANATIONS"
      ? "EXPLANATION"
      : "ANSWER";

  async function upload() {
    setMessage(null);
    setBatchId(null);
    if (questionFiles.length === 0) {
      setMessage("Select at least one Questions file (PDF or DOCX).");
      return;
    }
    if (oversized) {
      setMessage("The selected files exceed the 256 MB limit.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.set("name", name || `${modeLabel} import`);
    formData.set("contentType", mode);
    if (mode === "PRACTICE_SET") {
      formData.set("difficulty", selectedDifficulty);
      if (topicName) formData.set("topicName", topicName);
      if (domainName) formData.set("domainName", domainName);
    } else if (testNumber.trim()) {
      formData.set("testNumber", testNumber.trim());
    }
    for (const file of questionFiles) {
      formData.append("files", file);
      formData.append("roles", "QUESTION");
    }
    for (const file of answerFiles) {
      formData.append("files", file);
      formData.append("roles", answerRole);
    }

    const response = await fetch("/api/admin/ai-import/upload-sources", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error || "Could not create the import batch.");
      return;
    }
    setBatchId(data.id);
    setMessage(
      `Staging batch created with ${data.totalFiles ?? allFiles.length} files. Review and publish only this batch before assigning.`,
    );
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <FileUp size={16} />
        Import from PDF
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto shadow-xl" padding="none">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">{modeLabel}</p>
                <h2 className="text-base font-semibold text-gray-900">Import questions from PDF/DOCX</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close import modal">
                <X size={18} />
              </Button>
            </div>

            <div className="grid gap-4 px-5 py-4">
              <p className="text-sm text-gray-600">
                Use two trays: one for <strong>Questions</strong> and one for <strong>Answers / Explanations</strong>.
                Import creates a staging batch only; process, review, then publish before assigning to students.
              </p>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-gray-500">Batch name</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${modeLabel} import`} />
              </label>

              {mode === "PRACTICE_SET" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-gray-500">Skill detected from editor</span>
                    <Input value={[domainName, topicName].filter(Boolean).join(" / ") || "Manual topic"} readOnly />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-gray-500">Difficulty hint</span>
                    <Select value={selectedDifficulty} onChange={(event) => setSelectedDifficulty(event.target.value)}>
                      {difficultyOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              ) : (
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Test number hint</span>
                  <Input value={testNumber} onChange={(event) => setTestNumber(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Example: 7" />
                </label>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <FileTray
                  title="Questions"
                  hint="File type: Questions. Upload the questionnaire PDF/DOCX with stems, stimuli and options."
                  required
                  files={questionFiles}
                  disabled={loading}
                  onChange={setQuestionFiles}
                />
                <FileTray
                  title="Answers / Explanations"
                  hint="File type: Answers, Explanations, or Answers with explanations (one document)."
                  files={answerFiles}
                  disabled={loading}
                  onChange={setAnswerFiles}
                >
                  <label className="mb-2 flex items-start gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      checked={answersIncludeExplanations}
                      onChange={(event) => setAnswersIncludeExplanations(event.target.checked)}
                    />
                    <span>This second file includes answers <strong>with explanations</strong> in one document.</span>
                  </label>
                  {!answersIncludeExplanations && (
                    <Select
                      value={answerTrayKind}
                      onChange={(event) => setAnswerTrayKind(event.target.value as "ANSWERS" | "EXPLANATIONS")}
                      className="mb-2"
                    >
                      <option value="ANSWERS">Answers (answer key only)</option>
                      <option value="EXPLANATIONS">Explanations (explanations only)</option>
                    </Select>
                  )}
                </FileTray>
              </div>

              <p className={oversized ? "text-xs text-red-600" : "text-xs text-gray-500"}>
                {allFiles.length
                  ? `${allFiles.length} files selected, ${formatBytes(totalSize)} total.`
                  : "Select the Questions tray first. Answers/Explanations tray is recommended."}
              </p>

              {message && (
                <div className={batchId ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"}>
                  {message}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              {batchId && (
                <Button asChild variant="secondary">
                  <Link href={`/admin/import/ai?batch=${batchId}`}>
                    <ExternalLink size={16} />
                    Open this batch to review
                  </Link>
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="button" onClick={upload} disabled={loading || !name || questionFiles.length === 0 || oversized}>
                {loading ? "Creating batch..." : "Create staging batch"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
