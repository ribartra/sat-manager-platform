"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ScoringClient({ initialCsv }: { initialCsv: string }) {
  const [csv, setCsv] = useState(initialCsv || "RW,0,200\nMATH,0,200");
  const [saved, setSaved] = useState<number | null>(null);

  async function save() {
    const rows = csv.split(/\r?\n/).filter(Boolean).map((line) => {
      const [section, rawCorrect, score] = line.split(",").map((v) => v.trim());
      return { section, rawCorrect: Number(rawCorrect), score: Number(score) };
    });
    const res = await fetch("/api/full-practice-tests/scoring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setSaved(data.saved);
  }

  return (
    <div className="space-y-4">
      <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={14} className="font-mono text-xs" />
      <Button onClick={save}>Save Conversion Table</Button>
      {saved !== null && <p className="text-sm text-green-600">Saved {saved} rows.</p>}
    </div>
  );
}
