"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Radio } from "@/components/ui/checkbox";
import { InlineError } from "@/components/sat/alert";
import { ImportStepHeader } from "@/components/sat/import-steps";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { difficultyOptions } from "@/lib/domain-meta";

type Skill = { id: string; name: string; domainId: string; domain: string };
type Area = "MATH" | "READING" | "WRITING";
const AREAS: Array<{ code: Area; label: string }> = [
  { code: "MATH", label: "Math" },
  { code: "READING", label: "Reading" },
  { code: "WRITING", label: "Writing" },
];

/**
 * Step 1: Practice Set (section → domain → skill → level) or Test (number + name), source and the
 * original files. A Test comes as the originals do: one questions PDF per section (each with its two
 * modules) plus the answer key and explanations (PDF or Word); step 2 then goes module by module.
 */
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
  const [testNumber, setTestNumber] = useState("");
  const [testName, setTestName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rwFile, setRwFile] = useState<File | null>(null);
  const [mathFile, setMathFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const domains = [...new Map(skills[area].map((s) => [s.domainId, { id: s.domainId, name: s.domain }])).values()];
  const domainSkills = skills[area].filter((s) => !domainId || s.domainId === domainId);
  const missing =
    !sourceId ? "Choose the source." :
    kind === "PRACTICE_SET" && !topicId ? "Choose the skill." :
    kind === "PRACTICE_SET" && !difficulty ? "Choose the level." :
    kind === "FULL_PRACTICE_TEST" && !(Number(testNumber) >= 1) ? "Write the test number." :
    kind === "FULL_PRACTICE_TEST" && !testName.trim() ? "Write the test name." :
    kind === "PRACTICE_SET" && !file ? "Upload the questions PDF." :
    kind === "FULL_PRACTICE_TEST" && !rwFile && !mathFile ? "Upload the Reading and Writing or the Math questions PDF." : null;

  function changeKind(next: typeof kind) {
    setKind(next);
    const list = next === "PRACTICE_SET" ? practiceSources : testSources;
    setSourceId((current) => (list.some((s) => s.id === current) ? current : list[0]?.id ?? ""));
  }

  async function submit() {
    if (missing) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("sourceId", sourceId);
    if (kind === "PRACTICE_SET") {
      form.set("topicId", topicId);
      form.set("difficulty", difficulty);
    } else {
      form.set("testNumber", testNumber);
      form.set("testName", testName.trim());
    }
    if (kind === "PRACTICE_SET" && file) form.set("file", file);
    if (kind === "FULL_PRACTICE_TEST") {
      if (rwFile) form.set("rwFile", rwFile);
      if (mathFile) form.set("mathFile", mathFile);
    }
    for (const doc of answers) form.append("answers", doc);
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
      <ImportStepHeader step={1} title="What are you importing?" help="A new Draft Practice Set (one skill and level) or a new Test, its source and the original files." />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Content</legend>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="inline-flex items-center gap-2">
            <Radio checked={kind === "PRACTICE_SET"} onChange={() => changeKind("PRACTICE_SET")} /> A new Practice Set (one skill and level)
          </label>
          <label className="inline-flex items-center gap-2">
            <Radio checked={kind === "FULL_PRACTICE_TEST"} onChange={() => changeKind("FULL_PRACTICE_TEST")} /> A new Test (4 modules)
          </label>
        </div>
      </fieldset>

      {/* One 2-column grid for every field (labels and helps reserve the same height). */}
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {kind === "PRACTICE_SET" ? (
          <>
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
          </>
        ) : (
          <>
            <Field label="Test number" hint="TEST N groups the versions of one test across sources.">
              <Input
                type="number"
                min={1}
                max={999}
                value={testNumber}
                onChange={(e) => {
                  setTestNumber(e.target.value);
                  // Default name "TEST N" until the teacher writes their own.
                  if (!testName || /^TEST \d*$/.test(testName)) setTestName(e.target.value ? `TEST ${e.target.value}` : "");
                }}
                placeholder="1"
              />
            </Field>
            <Field label="Test name" hint="Shown to students.">
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="TEST 1" maxLength={120} />
            </Field>
          </>
        )}
        <Field label="Source" hint={sources.length ? "Where the content comes from (Admin › Sources)." : "No active source for this kind of content: ask an admin to add one."}>
          <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>

      {kind === "PRACTICE_SET" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FileTray label="Questions PDF" required hint="Kept to crop figures in step 3 and for the artifacts zip." files={file ? [file] : []} onChange={(files) => setFile(files[0] ?? null)} />
          <FileTray
            label="Answers / explanations"
            hint="PDF or Word. Give it to the AI too, so it can fill answers and explanations."
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            files={answers}
            onChange={(files) => setAnswers(files.slice(0, 1))}
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Upload the files as they come: one PDF per section, each with its <b>Module 1 and Module 2</b>. In step 2 you load the Test one module at a time. If a
            section comes as Word, save it as PDF first (File › Save as › PDF) so figures can be cropped.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FileTray label="Reading and Writing questions" hint="The R&W PDF (Module 1 and Module 2)." files={rwFile ? [rwFile] : []} onChange={(files) => setRwFile(files[0] ?? null)} />
            <FileTray label="Math questions" hint="The Math PDF (Module 1 and Module 2)." files={mathFile ? [mathFile] : []} onChange={(files) => setMathFile(files[0] ?? null)} />
            <FileTray
              label="Answer key & explanations"
              hint="PDF or Word, several files (answer key, R&W and Math explanations)."
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              files={answers}
              onChange={setAnswers}
            />
          </div>
        </>
      )}

      <InlineError>{error}</InlineError>
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={submit} disabled={busy} disabledReason={missing}>{busy ? "Uploading…" : "Continue to step 2"}</Button>
      </div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid content-start gap-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
      <span className="min-h-4 text-xs text-gray-500">{hint ?? ""}</span>
    </label>
  );
}

/** File picker in the AI Import tray style: dashed box, file name(s), choose button. */
function FileTray({
  label,
  hint,
  required = false,
  accept = ".pdf,application/pdf",
  multiple = false,
  files,
  onChange,
}: {
  label: string;
  hint: string;
  required?: boolean;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const word = accept.includes("docx") ? "file" : "PDF";
  return (
    <div className="flex h-full flex-col gap-2 rounded-[var(--sat-radius)] border border-dashed border-[var(--sat-border-strong)] bg-[var(--sat-surface-2)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <span className="text-xs text-gray-500">{required ? "Required" : "Optional"}</span>
      </div>
      <p className="text-xs text-gray-500">{hint}</p>
      <label className="mt-auto inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-[var(--sat-border)] bg-white px-3 py-1.5 text-sm font-medium hover:bg-[var(--sat-primary-soft)]">
        {files.length ? (multiple ? "Change files" : "Change file") : multiple ? `Choose ${word}s` : `Choose ${word}`}
        <input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
      </label>
      {files.length ? (
        files.map((f) => <p key={f.name} className="truncate text-xs text-gray-600" title={f.name}>{f.name}</p>)
      ) : (
        <p className="text-xs text-gray-600">No file chosen</p>
      )}
    </div>
  );
}
