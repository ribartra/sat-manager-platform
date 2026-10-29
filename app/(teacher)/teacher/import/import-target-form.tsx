"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Radio } from "@/components/ui/checkbox";
import { InlineError } from "@/components/sat/alert";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { difficultyOptions } from "@/lib/domain-meta";

type Skill = { id: string; name: string; domainId: string; domain: string };
type Area = "MATH" | "READING" | "WRITING";
const AREAS: Array<{ code: Area; label: string }> = [
  { code: "MATH", label: "Math" },
  { code: "READING", label: "Reading" },
  { code: "WRITING", label: "Writing" },
];

/** Step 1: Practice Set (section → domain → skill → level) or Test (name), source and the PDF. */
export function ImportTargetForm({
  skills,
  practiceSources,
  testSources,
  initial,
}: {
  skills: Record<Area, Skill[]>;
  practiceSources: { id: string; name: string }[];
  testSources: { id: string; name: string }[];
  initial: { kind: "PRACTICE_SET" | "FULL_PRACTICE_TEST"; topicId: string; difficulty: string; sourceId: string };
}) {
  const router = useRouter();
  const initialArea = (Object.keys(skills) as Area[]).find((area) => skills[area].some((s) => s.id === initial.topicId)) ?? "MATH";
  const initialSkill = skills[initialArea].find((s) => s.id === initial.topicId);
  const [kind, setKind] = useState(initial.kind);
  const [area, setArea] = useState<Area>(initialArea);
  const [domainId, setDomainId] = useState(initialSkill?.domainId ?? "");
  const [topicId, setTopicId] = useState(initialSkill?.id ?? "");
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const sources = kind === "PRACTICE_SET" ? practiceSources : testSources;
  const [sourceId, setSourceId] = useState(() => (sources.some((s) => s.id === initial.sourceId) ? initial.sourceId : sources[0]?.id ?? ""));
  const [testName, setTestName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const domains = [...new Map(skills[area].map((s) => [s.domainId, { id: s.domainId, name: s.domain }])).values()];
  const domainSkills = skills[area].filter((s) => !domainId || s.domainId === domainId);
  const missing =
    !sourceId ? "Choose the source." :
    kind === "PRACTICE_SET" && !topicId ? "Choose the skill." :
    kind === "PRACTICE_SET" && !difficulty ? "Choose the level." :
    kind === "FULL_PRACTICE_TEST" && !testName.trim() ? "Write the test name." :
    !file ? "Upload the questions PDF." : null;

  function changeKind(next: typeof kind) {
    setKind(next);
    const list = next === "PRACTICE_SET" ? practiceSources : testSources;
    setSourceId((current) => (list.some((s) => s.id === current) ? current : list[0]?.id ?? ""));
  }

  async function submit() {
    if (missing || !file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("sourceId", sourceId);
    if (kind === "PRACTICE_SET") {
      form.set("topicId", topicId);
      form.set("difficulty", difficulty);
    } else {
      form.set("testName", testName.trim());
    }
    form.set("file", file);
    if (answers) form.set("answers", answers);
    try {
      const data = await apiFetch<{ batchId: string }>("/api/import/quick", { method: "POST", body: form });
      router.push(`/teacher/import/${data.batchId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Step 1 · What are you importing?</h2>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="inline-flex items-center gap-2">
          <Radio checked={kind === "PRACTICE_SET"} onChange={() => changeKind("PRACTICE_SET")} /> A new Practice Set (one skill and level)
        </label>
        <label className="inline-flex items-center gap-2">
          <Radio checked={kind === "FULL_PRACTICE_TEST"} onChange={() => changeKind("FULL_PRACTICE_TEST")} /> A new Test (4 modules)
        </label>
      </div>

      {kind === "PRACTICE_SET" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Section">
            <Select value={area} onChange={(e) => { setArea(e.target.value as Area); setDomainId(""); setTopicId(""); }}>
              {AREAS.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
            </Select>
          </Field>
          <Field label="Domain">
            <Select value={domainId} onChange={(e) => { setDomainId(e.target.value); setTopicId(""); }}>
              <option value="">All domains</option>
              {domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Skill">
            <Select value={topicId} onChange={(e) => { setTopicId(e.target.value); setDomainId(skills[area].find((s) => s.id === e.target.value)?.domainId ?? domainId); }}>
              <option value="">Choose a skill</option>
              {domainSkills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Difficulty">
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Choose a level</option>
              {difficultyOptions().map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
      ) : (
        <Field label="Test name">
          <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. College Board 2025 · Test 1" maxLength={120} />
        </Field>
      )}

      <Field label="Source" hint={sources.length ? "Where the content comes from (Admin › Sources)." : "No active source for this kind of content: ask an admin to add one."}>
        <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Questions PDF (required)" hint="Kept to crop figures in step 3 and for the artifacts zip.">
          <input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
        </Field>
        <Field label="Answers / explanations PDF (optional)" hint="Give it to the AI too, so it can fill answers and explanations.">
          <input type="file" accept=".pdf,application/pdf" onChange={(e) => setAnswers(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
        </Field>
      </div>

      <InlineError>{error}</InlineError>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={submit} disabled={busy} disabledReason={missing}>{busy ? "Uploading…" : "Continue to step 2"}</Button>
      </div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}
