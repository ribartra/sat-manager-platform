"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ScoringClient({ initialCsv }: { initialCsv: string }) {
  const [csv, setCsv] = useState(initialCsv || "RW,0,200\nMATH,0,200");
  const [saved, setSaved] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ section: string; rawCorrect: number; score: number }[]>([]);
  const [loading, setLoading] = useState(false);

  function parseRows() {
    return csv.split(/\r?\n/).filter(Boolean).map((line) => {
      const [section, rawCorrect, score] = line.split(",").map((v) => v.trim());
      return { section, rawCorrect: Number(rawCorrect), score: Number(score) };
    });
  }

  async function validate() {
    setLoading(true);
    setSaved(null);
    const res = await fetch("/api/full-practice-tests/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parseRows(), dryRun: true }),
    });
    const data = await res.json();
    setPreview(data.rows ?? []);
    setErrors(data.errors ?? []);
    setWarnings(data.warnings ?? []);
    setLoading(false);
  }

  async function save() {
    setLoading(true);
    setSaved(null);
    setErrors([]);
    const res = await fetch("/api/full-practice-tests/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: parseRows() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrors(data.errors ?? [data.error ?? "Unable to save conversion table."]);
      setWarnings(data.warnings ?? []);
      setLoading(false);
      return;
    }
    setSaved(data.saved ?? 0);
    setWarnings(data.warnings ?? []);
    setPreview([]);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={14} className="font-mono text-xs" />
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={validate} disabled={loading}>
          {loading ? "Working..." : "Validate Table"}
        </Button>
        <Button onClick={save} disabled={loading || errors.length > 0}>
          Save Conversion Table
        </Button>
      </div>
      {preview.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Preview: {preview.length} valid rows</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {preview.slice(0, 18).map((row) => (
              <div key={`${row.section}-${row.rawCorrect}`} className="rounded border border-gray-100 px-2 py-1">
                {row.section} raw {row.rawCorrect}: <span className="font-medium">{row.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Fix these rows before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}
      {saved !== null && <p className="text-sm text-green-600">Saved {saved} rows.</p>}
    </div>
  );
}
