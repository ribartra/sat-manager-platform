"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tag } from "lucide-react";
import { explanationVisibilityOptions, difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  sectionLabel: string;
  questionCount: number;
  alreadyAssigned: boolean;
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
}

export function AssignForm({ studentId, practiceSets, groups, groupAssignmentEnabled }: AssignFormProps) {
  const router = useRouter();
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [explVisibility, setExplVisibility] = useState("AFTER_FINISH");
  const [lockOnAssign, setLockOnAssign] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);

  const filtered = practiceSets.filter((ps) =>
    !search ||
    ps.name.toLowerCase().includes(search.toLowerCase()) ||
    ps.topicName.toLowerCase().includes(search.toLowerCase())
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
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds,
        practiceSetIds: [...selected],
        sourceGroupId: useGroup ? groupId : null,
        dueDate: dueDate || null,
        unlockAt: unlockAt || null,
        locked: lockOnAssign,
      }),
    });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push(`/teacher/students/${studentId}`), 1200);
  }

  return (
    <div className="space-y-6">
      <Card padding="md">
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-48 text-xs"
          />
        </div>
        <Card className="max-h-80 overflow-y-auto overflow-hidden">
          {filtered.map((ps) => (
            <label
              key={ps.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors",
                selected.has(ps.id) && "bg-blue-50",
                target === "student" && ps.alreadyAssigned && "opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(ps.id)}
                onChange={() => (target === "group" || !ps.alreadyAssigned) && toggleSelect(ps.id)}
                disabled={target === "student" && ps.alreadyAssigned}
                className="rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{ps.name}</p>
                <p className="text-xs text-gray-500">{ps.sectionLabel} · {ps.topicName} · {ps.questionCount} questions</p>
              </div>
              <Badge variant={difficultyBadgeVariant(ps.difficulty)}>{difficultyLabel(ps.difficulty)}</Badge>
              {target === "student" && ps.alreadyAssigned && <span className="text-xs text-gray-400">Assigned</span>}
            </label>
          ))}
        </Card>
        <p className="text-xs text-gray-400 mt-1">{selected.size} selected</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unlock Date (optional)</label>
          <Input type="date" value={unlockAt} onChange={(e) => setUnlockAt(e.target.value)} />
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
        <p className="text-sm text-green-600 font-medium">✓ Assigned successfully! Redirecting...</p>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleAssign} disabled={selected.size === 0 || loading}>
          {loading ? "Assigning..." : `Assign ${selected.size > 0 ? `(${selected.size})` : ""}`}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </div>
  );
}
