"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MathContent } from "@/components/math-content";

const template = `topicId,difficulty,type,status,stem,correctAnswer,optionA,optionB,optionC,optionD,optionAImageUrl,optionBImageUrl,optionCImageUrl,optionDImageUrl,stimulus,explanation,imageUrl
TOPIC_ID,EASY,MC,DRAFT,Which value satisfies 2x+6=14?,C,x=2,x=3,x=4,x=5,,,,,,Subtract 6 then divide by 2.,`;

interface PreviewRow {
  rowNumber: number;
  topicId: string;
  stem: string;
  type: string;
  status: string;
  valid: boolean;
  errors: string[];
}

export function BulkImportClient({ topics }: { topics: { id: string; label: string }[] }) {
  const [csv, setCsv] = useState(template);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [preview, setPreview] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    rows: PreviewRow[];
  } | null>(null);
  const [previewSource, setPreviewSource] = useState("");

  async function previewAndValidate() {
    setPreviewLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, dryRun: true }),
    });
    setPreview(await res.json());
    setPreviewSource(csv);
    setPreviewLoading(false);
  }

  async function submit() {
    setLoading(true);
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={14} className="font-mono text-xs" />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={previewAndValidate} disabled={previewLoading}>
            {previewLoading ? "Validating..." : "Preview & Validate"}
          </Button>
          <Button onClick={submit} disabled={loading || !preview || previewSource !== csv}>
            {loading ? "Importing..." : "Import Previewed Rows"}
          </Button>
          <Link href="/teacher/questions" className="text-sm text-blue-600 hover:underline">Back to Question Bank</Link>
        </div>
        {preview && (
          <Card className="overflow-hidden">
            <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
              Rows: {preview.totalRows} · Valid: {preview.validRows} · Invalid: {preview.invalidRows}
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">Row</th><th className="px-3 py-2 text-left">Skill ID (topicId)</th><th className="px-3 py-2 text-left">Stem</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Validation</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-gray-500">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{row.topicId}</td>
                    <td className="px-3 py-2 text-gray-800">
                      <MathContent content={row.stem} className="line-clamp-2" />
                    </td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        <span className="text-green-700">OK</span>
                      ) : (
                        <span className="text-red-600">{row.errors.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {result && (
          <Card padding="md">
            <p className="text-sm font-medium text-gray-900">Created: {result.created}</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {result.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
          </Card>
        )}
      </div>
      <Card padding="md">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Skill IDs</h2>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {topics.map((topic) => (
            <div key={topic.id}>
              <p className="text-xs font-medium text-gray-700">{topic.label}</p>
              <p className="break-all font-mono text-xs text-gray-400">{topic.id}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
