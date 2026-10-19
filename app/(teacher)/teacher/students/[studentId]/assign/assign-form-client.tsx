"use client";

import { Checkbox, Radio } from "@/components/ui/checkbox";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, localToday } from "@/lib/utils";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignmentStatusLabel, difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  topicId: string;
  /** Official display order (lib/taxonomy-order.ts). */
  domainOrder: number;
  skillOrder: number;
  domainId: string;
  domainName: string;
  practiceArea: PracticeAreaCode | null;
  questionCount: number;
  /** Current assignment of this set for the student, if any. */
  assignment: { status: string; dueDate: string | null } | null;
}

/** What assigning again will do, mirroring upsertPracticeAssignment in lib/assignments.ts. */
function assignmentHint(assignment: PracticeSetInfo["assignment"]) {
  if (!assignment) return null;
  switch (assignment.status) {
    case "PENDING":
      return { label: "Not started", action: "will update", className: "text-blue-600" };
    case "IN_PROGRESS":
      return { label: "In progress", action: "will update", className: "text-amber-600" };
    case "OVERDUE":
      return { label: "Overdue", action: "will reassign", className: "text-rose-600" };
    case "COMPLETED":
      return { label: "Completed", action: "will reassign", className: "text-emerald-600" };
    default:
      return { label: assignmentStatusLabel(assignment.status), action: "", className: "text-gray-500" };
  }
}

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
  /** `${topicId}:${difficulty}` of the student's weakest practice skills (shown first, "Recommended"). */
  recommended?: string[];
  practiceSets: PracticeSetInfo[];
  groups: GroupInfo[];
  groupAssignmentEnabled: boolean;
  initialArea: "all" | "math" | "reading" | "writing";
  initialDomain?: string;
  initialTopic?: string;
  initialDifficulty?: string;
  initialSelected?: string[];
}

export function AssignForm({
  studentId,
  studentName,
  recommended = [],
  practiceSets,
  groups,
  groupAssignmentEnabled,
  initialArea,
  initialDomain,
  initialTopic,
  initialDifficulty,
  initialSelected,
}: AssignFormProps) {
  const router = useRouter();
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialSelected ?? []).filter((id) => practiceSets.some((ps) => ps.id === id))),
  );
  // Due date starts one week after today (end of that day); the teacher can change it.
  const [dueDate, setDueDate] = useState(() => addDays(localToday(), 7));
  const [unlockAt, setUnlockAt] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<"AFTER_SET" | "IMMEDIATE">("AFTER_SET");
  const [lockOnAssign, setLockOnAssign] = useState(false);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<AssignFormProps["initialArea"]>(initialArea);
  const [domainId, setDomainId] = useState(initialDomain ?? "");
  const [topicId, setTopicId] = useState(initialTopic ?? "");
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllMembers, setShowAllMembers] = useState(false);

  const areaSets = practiceSets.filter((ps) => area === "all" || ps.practiceArea?.toLowerCase() === area);
  const domains = [...new Map(areaSets.map((ps) => [ps.domainId, { id: ps.domainId, name: ps.domainName, order: ps.domainOrder }])).values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const domainSets = domainId ? areaSets.filter((ps) => ps.domainId === domainId) : areaSets;
  const topics = [...new Map(domainSets.map((ps) => [ps.topicId, { id: ps.topicId, name: ps.topicName, order: ps.skillOrder }])).values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const recommendedKeys = new Set(recommended);
  const isRecommended = (ps: PracticeSetInfo) => recommendedKeys.has(`${ps.topicId}:${ps.difficulty}`);
  const filtered = domainSets
    .filter((ps) =>
      (!topicId || ps.topicId === topicId) &&
      (!difficulty || ps.difficulty === difficulty) &&
      (!search || ps.name.toLowerCase().includes(search.toLowerCase()) || ps.topicName.toLowerCase().includes(search.toLowerCase()) || ps.domainName.toLowerCase().includes(search.toLowerCase()))
    )
    // Weak skills first (stable: keeps the official order inside each group).
    .sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a)));
  const first = studentName.split(" ")[0];
  const backHref = (() => {
    const params = new URLSearchParams();
    if (area !== "all") params.set("area", area);
    if (domainId) params.set("domain", domainId);
    if (topicId) params.set("topic", topicId);
    if (difficulty) params.set("difficulty", difficulty);
    return `/teacher/students/${studentId}${params.toString() ? `?${params.toString()}` : ""}`;
  })();

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
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
          <label className="text-sm font-medium text-gray-700">
            Practice area
            <Select value={area} onChange={(event) => { setArea(event.target.value as AssignFormProps["initialArea"]); setDomainId(""); setTopicId(""); }} className="mt-1">
              <option value="all">All areas</option>
              <option value="math">Math</option>
              <option value="reading">Reading</option>
              <option value="writing">Writing</option>
            </Select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Search practice
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Practice set, skill or domain" className="mt-1" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Domain
            <Select value={domainId} onChange={(event) => { setDomainId(event.target.value); setTopicId(""); }} className="mt-1">
              <option value="">All domains</option>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
            </Select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Skill
            <Select value={topicId} onChange={(event) => setTopicId(event.target.value)} className="mt-1">
              <option value="">All skills</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </Select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Difficulty
            <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-1">
              <option value="">All levels</option>
              {difficultyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </label>
        </div>
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
      </Card>

      {/* Practice set selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Select practice sets</label>
        </div>
        <Card className="max-h-80 overflow-y-auto overflow-hidden">
          {filtered.map((ps) => (
            <label
              key={ps.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors",
                selected.has(ps.id) && "bg-blue-50",
              )}
            >
              <Checkbox
                checked={selected.has(ps.id)}
                onChange={() => toggleSelect(ps.id)}
                className="rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ps.name}</p>
                <p className="text-xs text-gray-500">{practiceAreaLabel(ps.practiceArea) || "Unclassified"} · {ps.domainName} · {ps.topicName} · {ps.questionCount} questions</p>
              </div>
              {isRecommended(ps) ? <Badge variant="info" className="shrink-0">Recommended</Badge> : null}
              <span className="shrink-0 text-xs font-medium text-gray-700">{difficultyLabel(ps.difficulty)}</span>
              {target === "student" && (() => {
                const hint = assignmentHint(ps.assignment);
                if (!hint) return null;
                return (
                  <span className={cn("shrink-0 text-right text-xs", hint.className)}>
                    {hint.label}
                    {ps.assignment?.dueDate ? ` · due ${new Date(ps.assignment.dueDate).toLocaleDateString()}` : ""}
                    {hint.action && <span className="block text-[11px] text-gray-400">{hint.action}</span>}
                  </span>
                );
              })()}
            </label>
          ))}
          {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">No practice sets in this area.</p>}
        </Card>
        <p className="text-xs text-gray-400 mt-1">{selected.size} selected</p>
      </div>

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

      <aside className="lg:sticky lg:top-20">
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
                <li key={ps.id} className="truncate">{ps.topicName} · {difficultyLabel(ps.difficulty)}</li>
              ))}
            </ul>
          ) : null}
          <Button className="w-full" onClick={handleAssign} disabled={loading} disabledReason={selected.size === 0 ? "Select at least one practice set." : null}>
            {loading ? "Assigning..." : `Assign ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </Card>
      </aside>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assigned</DialogTitle>
            <DialogDescription>{successMessage || "Assigned"}. {target === "group" ? "The group's students" : first} will see it on their Home and Practice pages.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(new Set());
                setSuccess(false);
              }}
            >
              Assign more
            </Button>
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
