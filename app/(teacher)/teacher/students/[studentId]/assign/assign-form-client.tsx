"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { explanationVisibilityOptions, difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  topicId: string;
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
      return { label: "Pending", action: "will update", className: "text-blue-600" };
    case "IN_PROGRESS":
      return { label: "In progress", action: "will update", className: "text-amber-600" };
    case "OVERDUE":
      return { label: "Overdue", action: "will reassign", className: "text-rose-600" };
    case "COMPLETED":
      return { label: "Completed", action: "will reassign", className: "text-emerald-600" };
    default:
      return { label: assignment.status, action: "", className: "text-gray-500" };
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
  const [dueDate, setDueDate] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [explVisibility, setExplVisibility] = useState("AFTER_FINISH");
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
  const domains = [...new Map(areaSets.map((ps) => [ps.domainId, { id: ps.domainId, name: ps.domainName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const domainSets = domainId ? areaSets.filter((ps) => ps.domainId === domainId) : areaSets;
  const topics = [...new Map(domainSets.map((ps) => [ps.topicId, { id: ps.topicId, name: ps.topicName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const filtered = domainSets.filter((ps) =>
    (!topicId || ps.topicId === topicId) &&
    (!difficulty || ps.difficulty === difficulty) &&
    (!search || ps.name.toLowerCase().includes(search.toLowerCase()) || ps.topicName.toLowerCase().includes(search.toLowerCase()) || ps.domainName.toLowerCase().includes(search.toLowerCase()))
  );

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
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setLoading(false);
      setSuccess(false);
      setError(data.error || "Unable to assign the selected practice sets.");
      return;
    }
    setLoading(false);
    const created = Number(data.created) || 0;
    const updated = Number(data.updated) || 0;
    const reassigned = Number(data.reassigned) || 0;
    if (created + updated + reassigned === 0) {
      setSuccess(false);
      setError("Nothing changed: the selected sets are already pending with these settings.");
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
    setTimeout(() => {
      const params = new URLSearchParams();
      if (area !== "all") params.set("area", area);
      if (domainId) params.set("domain", domainId);
      if (topicId) params.set("topic", topicId);
      if (difficulty) params.set("difficulty", difficulty);
      router.push(`/teacher/students/${studentId}${params.toString() ? `?${params.toString()}` : ""}`);
    }, 1200);
  }

  return (
    <div className="space-y-6">
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
            <input type="radio" checked={target === "student"} onChange={() => setTarget("student")} />
            This student
          </label>
          {groupAssignmentEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={target === "group"} onChange={() => { setTarget("group"); setShowAllMembers(false); }} disabled={groups.length === 0} />
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
          <label className="text-sm font-medium text-gray-700">Select Practice Sets</label>
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
              <input
                type="checkbox"
                checked={selected.has(ps.id)}
                onChange={() => toggleSelect(ps.id)}
                className="rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ps.name}</p>
                <p className="text-xs text-gray-500">{practiceAreaLabel(ps.practiceArea) || "Unclassified"} · {ps.domainName} · {ps.topicName} · {ps.questionCount} questions</p>
              </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <p className="mt-1 text-xs text-gray-400">
            Due at the end of that day. Empty: no due date; sets already pending keep their current due date.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unlock Date (optional)</label>
          <Input type="date" value={unlockAt} onChange={(e) => setUnlockAt(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feedback mode</label>
          <Select value={feedbackMode} onChange={(e) => setFeedbackMode(e.target.value as "AFTER_SET" | "IMMEDIATE")}>
            <option value="AFTER_SET">After set (default) — no Check until submit</option>
            <option value="IMMEDIATE">Immediate — Check after each answer</option>
          </Select>
          <p className="mt-1 text-xs text-gray-400">
            Applies to the whole Practice Set for this assignment. Mocks never use Immediate.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Explanation Visibility</label>
          <Select value={explVisibility} onChange={(e) => setExplVisibility(e.target.value)}>
            {explanationVisibilityOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-400">
            Set-level content visibility (legacy). Feedback mode above controls the Check button.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="lock"
          checked={lockOnAssign}
          onChange={(e) => setLockOnAssign(e.target.checked)}
          className="rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="lock" className="text-sm text-gray-700">
          Lock on assign (unlock manually later)
        </label>
      </div>

      {success && (
        <p className="text-sm font-medium text-green-600">✓ {successMessage || "Assigned"}. Redirecting...</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={handleAssign} disabled={selected.size === 0 || loading}>
          {loading ? "Assigning..." : `Assign ${selected.size > 0 ? `(${selected.size})` : ""}`}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}
