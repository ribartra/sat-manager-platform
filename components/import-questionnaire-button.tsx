"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

type ImportMode = "PRACTICE_SET" | "FULL_PRACTICE_TEST";

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

export function ImportQuestionnaireButton({ mode, defaultName, topicName, domainName, difficulty }: ImportQuestionnaireButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty ?? "EASY");
  const [testNumber, setTestNumber] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const oversized = totalSize > MAX_UPLOAD_BYTES;
  const modeLabel = mode === "PRACTICE_SET" ? "Practice Set" : "Full Practice Test";

  async function upload() {
    setMessage(null);
    setBatchId(null);
    if (files.length === 0) {
      setMessage("Select at least one PDF or DOCX file.");
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
    for (const file of files) formData.append("files", file);

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
    setMessage(`Staging batch created with ${data.totalFiles ?? files.length} files. Process and review it before promoting questions.`);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <FileUp size={16} />
        Import from PDF
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl" padding="none">
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
                Upload all files that belong to this questionnaire: questions, alternatives, answer keys and explanations. The import creates a staging batch only; processing, review and promotion are manual.
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
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </Select>
                  </label>
                </div>
              ) : (
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Test number hint</span>
                  <Input value={testNumber} onChange={(event) => setTestNumber(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Example: 7" />
                </label>
              )}

              <label className="grid gap-1">
                <span className="text-xs font-medium text-gray-500">Questionnaire files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700"
                  disabled={loading}
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                <span className={oversized ? "text-xs text-red-600" : "text-xs text-gray-500"}>
                  {files.length ? `${files.length} files selected, ${formatBytes(totalSize)} total.` : "PDF and DOCX only. Maximum total upload: 256 MB."}
                </span>
              </label>

              {files.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0">
                      <span className="min-w-0 truncate text-xs text-gray-700" title={file.name}>{file.name}</span>
                      <span className="shrink-0 text-xs text-gray-400">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              )}

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
                    Open review workspace
                  </Link>
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="button" onClick={upload} disabled={loading || !name || files.length === 0 || oversized}>
                {loading ? "Creating batch..." : "Create staging batch"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
