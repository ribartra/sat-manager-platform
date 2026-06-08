"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  sectionLabel: string;
  questionCount: number;
  alreadyAssigned: boolean;
}

interface GroupInfo {
  id: string;
  name: string;
  memberIds: string[];
}

interface AssignFormProps {
  studentId: string;
  practiceSets: PracticeSetInfo[];
  groups: GroupInfo[];
}

export function AssignForm({ studentId, practiceSets, groups }: AssignFormProps) {
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
    const studentIds = target === "group" ? group?.memberIds ?? [] : [studentId];
    if (studentIds.length === 0) return;
    setLoading(true);
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds,
        practiceSetIds: [...selected],
        dueDate: dueDate || null,
        unlockAt: unlockAt || null,
        explanationVisibility: explVisibility,
        locked: lockOnAssign,
      }),
    });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push(`/teacher/students/${studentId}`), 1200);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Assign to</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" checked={target === "student"} onChange={() => setTarget("student")} />
            This student
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" checked={target === "group"} onChange={() => setTarget("group")} disabled={groups.length === 0} />
            Group
          </label>
          {target === "group" && (
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="max-w-xs">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberIds.length} students)
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

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
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden max-h-80 overflow-y-auto">
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
              <Badge variant={ps.difficulty === "EASY" ? "easy" : ps.difficulty === "MEDIUM" ? "medium" : "hard"}>
                {ps.difficulty}
              </Badge>
              {target === "student" && ps.alreadyAssigned && <span className="text-xs text-gray-400">Assigned</span>}
            </label>
          ))}
        </div>
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
            <option value="IMMEDIATE">Show immediately</option>
            <option value="AFTER_FINISH">Show after finish</option>
            <option value="HIDDEN">Hidden</option>
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
