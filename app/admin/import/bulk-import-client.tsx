"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const template = `topicId,difficulty,type,status,stem,correctAnswer,optionA,optionB,optionC,optionD,stimulus,explanation
TOPIC_ID,EASY,MC,DRAFT,Which value satisfies 2x+6=14?,C,x=2,x=3,x=4,x=5,,Subtract 6 then divide by 2.`;

function parseRows(csv: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const [headersLine, ...rows] = lines;
  const headers = headersLine.split(",").map((h) => h.trim());
  return rows.map((row) => {
    const values = row.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export function BulkImportClient({ topics }: { topics: { id: string; label: string }[] }) {
  const [csv, setCsv] = useState(template);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);

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
          <Button variant="secondary" onClick={() => setPreview(parseRows(csv))}>Preview & Validate</Button>
          <Button onClick={submit} disabled={loading || preview.length === 0}>{loading ? "Importing..." : "Import Previewed Rows"}</Button>
          <Link href="/teacher/questions" className="text-sm text-blue-600 hover:underline">Back to Question Bank</Link>
        </div>
        {preview.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">Topic ID</th><th className="px-3 py-2 text-left">Stem</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-gray-500">{row.topicId}</td>
                    <td className="px-3 py-2 text-gray-800">{row.stem}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">Created: {result.created}</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {result.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Topic IDs</h2>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {topics.map((topic) => (
            <div key={topic.id}>
              <p className="text-xs font-medium text-gray-700">{topic.label}</p>
              <p className="break-all font-mono text-xs text-gray-400">{topic.id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
