"use client";

import { Checkbox, Radio } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, localToday } from "@/lib/utils";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignmentStatusLabel, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { SkillsSourceMap, DIFFICULTIES, type SkillsMapChip, type SkillsSourceSkill } from "@/components/sat/skills-map";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  topicId: string;
  /** Official domain order (lib/taxonomy-order.ts); skills are listed A–Z inside each domain. */
  domainOrder: number;
  domainId: string;
  domainName: string;
  sourceId: string;
  sourceName: string;
  sourceOrder: number;
  practiceArea: PracticeAreaCode | null;
  questionCount: number;
}

/** A set the student already has, opened from "Edit" to change its dates/settings (never re-assigned). */
interface EditingSetInfo {
  id: string;
  name: string;
  difficulty: string;
  status: string;
  dueDate: string | null;
}

const AREAS: Array<{ key: "math" | "reading" | "writing"; code: PracticeAreaCode }> = [
  { key: "math", code: "MATH" },
  { key: "reading", code: "READING" },
  { key: "writing", code: "WRITING" },
];

interface GroupMember {
  id: string;
  name: string;
}

interface GroupInfo {
  id: string;
  name: string;
  members: GroupMember[];
}

interface AssignFormProps {
  studentId: string;
  studentName: string;
  /** Only the sets the student does NOT have yet (already assigned ones are never offered again). */
  practiceSets: PracticeSetInfo[];
  /** Non-empty = edit mode: change the settings of these already-assigned sets. */
  editing?: EditingSetInfo[];
  groups: GroupInfo[];
  groupAssignmentEnabled: boolean;
  initialArea: "math" | "reading" | "writing";
}

export function AssignForm({
  studentId,
  studentName,
  practiceSets,
  editing = [],
  groups,
  groupAssignmentEnabled,
  initialArea,
}: AssignFormProps) {
  const router = useRouter();
  const editMode = editing.length > 0;
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(editing.map((set) => set.id)));
  // Due date starts one week after today (end of that day), or the set's current one when editing.
  const [dueDate, setDueDate] = useState(() => editing[0]?.dueDate?.slice(0, 10) ?? addDays(localToday(), 7));
  const [unlockAt, setUnlockAt] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<"AFTER_SET" | "IMMEDIATE">("AFTER_SET");
  const [lockOnAssign, setLockOnAssign] = useState(false);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<AssignFormProps["initialArea"]>(initialArea);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllMembers, setShowAllMembers] = useState(false);

  const areaCode = AREAS.find((a) => a.key === area)!.code;
  const needle = search.trim().toLowerCase();
  // The By-skill cards (same component as Practice › By skill): domains in official order, skills A–Z;
  // a skill opens to one row per source with one toggle chip per set the student doesn't have yet.
  const domains = useMemo(() => {
    const areaSets = practiceSets.filter(
      (ps) => ps.practiceArea === areaCode && (!needle || ps.name.toLowerCase().includes(needle) || ps.topicName.toLowerCase().includes(needle)),
    );
    const byDomain = new Map<string, { id: string; name: string; order: number; skills: Map<string, { id: string; name: string; sets: PracticeSetInfo[] }> }>();
    for (const ps of areaSets) {
      const domain = byDomain.get(ps.domainId) ?? byDomain.set(ps.domainId, { id: ps.domainId, name: ps.domainName, order: ps.domainOrder, skills: new Map() }).get(ps.domainId)!;
      const skill = domain.skills.get(ps.topicId) ?? domain.skills.set(ps.topicId, { id: ps.topicId, name: ps.topicName, sets: [] }).get(ps.topicId)!;
      skill.sets.push(ps);
    }
    return [...byDomain.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map((domain) => ({
      id: domain.id,
      name: domain.name,
      skills: [...domain.skills.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" })),
    }));
  }, [practiceSets, areaCode, needle]);
  const first = studentName.split(" ")[0];
  const backHref = `/teacher/students/${studentId}?area=${area}`;
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    const group = groups.find((g) => g.id === groupId);
    const useGroup = groupAssignmentEnabled && target === "group";
    const studentIds = useGroup ? group?.members.map((m) => m.id) ?? [] : [studentId];
    if (studentIds.length === 0) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds,
        practiceSetIds: [...selected],
        sourceGroupId: useGroup ? groupId : null,
        dueDate: dueDate || null,
        unlockAt: unlockAt || null,
        locked: lockOnAssign,
        feedbackMode,
      }),
    });
    if (!response.ok) {
      setLoading(false);
      setSuccess(false);
      setError(errorMessage(await readApiError(response, "Unable to assign the selected practice sets.")));
      return;
    }
    const data = await response.json();
    setLoading(false);
    const created = Number(data.created) || 0;
    const updated = Number(data.updated) || 0;
    const reassigned = Number(data.reassigned) || 0;
    if (created + updated + reassigned === 0) {
      setSuccess(false);
      setError("Nothing changed: the selected sets are already assigned with these settings.");
      return;
    }
    setSuccessMessage(
      [
        created ? `${created} assigned` : null,
        reassigned ? `${reassigned} reassigned` : null,
        updated ? `${updated} updated` : null,
      ].filter(Boolean).join(" · "),
    );
    setSuccess(true);
    setError("");
    router.refresh();
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
      <Card padding="md">
        {editMode ? (
          <>
            <h2 className="text-sm font-semibold text-gray-900">Change the settings of what {first} already has</h2>
            <p className="mt-0.5 text-xs text-gray-500">The student keeps the progress and can retry as many times as needed; nothing is assigned again.</p>
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {editing.map((set) => (
                <li key={set.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-gray-800">{set.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">{difficultyLabel(set.difficulty)} · {assignmentStatusLabel(set.status)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
        <>
        <label className="mb-2 block text-sm font-medium text-gray-700">Assign to</label>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Radio checked={target === "student"} onChange={() => setTarget("student")} />
            This student
          </label>
          {groupAssignmentEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Radio checked={target === "group"} onChange={() => { setTarget("group"); setShowAllMembers(false); }} disabled={groups.length === 0} />
              Group
            </label>
          )}
          {target === "group" && (
            <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setShowAllMembers(false); }} className="max-w-xs">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members.length} students)
                </option>
              ))}
            </Select>
          )}
        </div>
        {target === "group" && (() => {
          const group = groups.find((g) => g.id === groupId);
          if (!group || group.members.length === 0) return <p className="mt-2 text-xs text-gray-400">This group has no members yet.</p>;
          const MAX = 5;
          const visible = showAllMembers ? group.members : group.members.slice(0, MAX);
          const hiddenCount = group.members.length - MAX;
          return (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visible.map((m) => (
                <span key={m.id} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                  {m.name}
                </span>
              ))}
              {!showAllMembers && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(true)}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-200 transition-colors"
                >
                  <Tag size={10} /> View all ({hiddenCount} more)
                </button>
              )}
            </div>
          );
        })()}
        </>
        )}
      </Card>

      {/* Practice set picker: Practice › By skill cards, only sets the student doesn't have yet */}
      {editMode ? null : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div role="tablist" aria-label="Practice area" className="flex gap-1 text-sm">
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="tab"
                  aria-selected={area === a.key}
                  onClick={() => setArea(a.key)}
                  className={cn("rounded-md px-3 py-1.5 font-medium", area === a.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")}
                >
                  {practiceAreaLabel(a.code)}
                </button>
              ))}
            </div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Skill or practice set name" aria-label="Search practice" className="max-w-xs text-sm" />
          </div>
          <p className="text-xs text-gray-500">Open a skill and pick sets by source and level. Sets {first} already has are not listed (they can be retried any time).</p>
          <SkillsSourceMap
            emptyText={
              needle
                ? "No practice set matches the search."
                : `No ${practiceAreaLabel(areaCode)} practice set to assign: ${first} already has every published set of their program, or there is none yet.`
            }
            emptySourcesText="No set to assign."
            domains={domains.map((domain) => ({
              id: domain.id,
              name: domain.name,
              skills: domain.skills.map((skill): SkillsSourceSkill => {
                const picked = skill.sets.filter((ps) => selected.has(ps.id)).length;
                const sources = [...new Map(skill.sets.map((ps) => [ps.sourceId, { id: ps.sourceId, name: ps.sourceName, order: ps.sourceOrder }])).values()].sort(
                  (a, b) => a.order - b.order || a.name.localeCompare(b.name),
                );
                return {
                  id: skill.id,
                  name: skill.name,
                  sub: `${skill.sets.length} set${skill.sets.length === 1 ? "" : "s"} to assign${picked ? ` · ${picked} selected` : ""}`,
                  open: Boolean(needle) || picked > 0 ? true : undefined,
                  chips: DIFFICULTIES.map((level): SkillsMapChip => {
                    const count = skill.sets.filter((ps) => ps.difficulty === level).length;
                    return count
                      ? { difficulty: level, state: "available", title: `${count} set${count === 1 ? "" : "s"} to assign`, extra: <span className="text-[var(--sat-muted)]">{count} set{count === 1 ? "" : "s"}</span> }
                      : { difficulty: level, state: "none", title: "Nothing to assign at this level" };
                  }),
                  rows: sources.map((source) => {
                    const sets = skill.sets.filter((ps) => ps.sourceId === source.id);
                    return {
                      id: source.id,
                      name: source.name,
                      chips: DIFFICULTIES.flatMap((level) => {
                        const ofLevel = sets.filter((ps) => ps.difficulty === level);
                        return ofLevel.map((ps): SkillsMapChip => ({
                          difficulty: level,
                          state: "available",
                          label: ofLevel.length > 1 ? setNumber(ps.name) : undefined,
                          title: `${ps.name} · ${ps.questionCount} questions`,
                          extra: <span className="text-[var(--sat-muted)]">{ps.questionCount} Q</span>,
                          selected: selected.has(ps.id),
                          onClick: () => toggleSelect(ps.id),
                        }));
                      }),
                    };
                  }),
                };
              }),
            }))}
          />
          <p className="text-xs text-gray-400">{selected.size} selected</p>
        </section>
      )}

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <p className="mt-1 text-xs text-gray-400">
            Due at the end of that day. Starts one week from today; change it if needed.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Open date (optional)</label>
          <Input type="date" value={unlockAt} onChange={(e) => setUnlockAt(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">When to show answers</label>
          <Select value={feedbackMode} onChange={(e) => setFeedbackMode(e.target.value as "AFTER_SET" | "IMMEDIATE")}>
            <option value="AFTER_SET">Show answers at the end</option>
            <option value="IMMEDIATE">Show the answer after each question</option>
          </Select>
          <p className="mt-1 text-xs text-gray-400">
            Applies to the whole practice set.
          </p>
        </div>
        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">Explanations</p>
          <p className="text-xs text-gray-500">
            Each practice set has its own setting for when explanations are shown. Change it by editing the set.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="lock"
          checked={lockOnAssign}
          onChange={(e) => setLockOnAssign(e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="lock" className="text-sm text-gray-700">
          Keep it locked for now (you unlock it later)
        </label>
      </div>

      <InlineError>{error}</InlineError>
      </div>

      <aside className="lg:sticky lg:top-6">
        <Card padding="md" className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">To</dt>
              <dd className="text-right font-medium text-gray-900">
                {target === "group" ? groups.find((g) => g.id === groupId)?.name ?? "Group" : studentName}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Practice sets</dt>
              <dd className="font-medium text-gray-900">{selected.size}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-500">Due</dt>
              <dd className="font-medium text-gray-900">{dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No due date"}</dd>
            </div>
          </dl>
          {selected.size > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-gray-100 pt-2 text-xs text-gray-600">
              {practiceSets.filter((ps) => selected.has(ps.id)).map((ps) => (
                <li key={ps.id} className="truncate">{ps.topicName} · {difficultyLabel(ps.difficulty)} · {ps.sourceName}</li>
              ))}
              {editing.map((set) => (
                <li key={set.id} className="truncate">{set.name}</li>
              ))}
            </ul>
          ) : null}
          <Button className="w-full" onClick={handleAssign} disabled={loading} disabledReason={selected.size === 0 ? "Select at least one practice set." : null}>
            {editMode ? (loading ? "Saving..." : "Save changes") : loading ? "Assigning..." : `Assign ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </Card>
      </aside>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? "Saved" : "Assigned"}</DialogTitle>
            <DialogDescription>{successMessage || "Assigned"}. {target === "group" ? "The group's students" : first} will see it on their Home and Practice pages.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {editMode ? null : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(new Set());
                  setSuccess(false);
                }}
              >
                Assign more
              </Button>
            )}
            <Button onClick={() => router.push(backHref)}>Back to {first}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** YYYY-MM-DD plus `days` (calendar days, local). */
function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "… - HARD - #2" → "#2" (several sets of one skill, level and source). */
function setNumber(name: string) {
  return name.match(/#\d+\s*$/)?.[0].trim() ?? name;
}
