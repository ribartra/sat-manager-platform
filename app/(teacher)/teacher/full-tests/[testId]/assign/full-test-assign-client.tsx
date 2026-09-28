"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StudentPicker } from "@/components/student-picker";
import { cn } from "@/lib/utils";

export function FullTestAssignClient({
  testId,
  students,
  groups,
  groupAssignmentEnabled,
}: {
  testId: string;
  students: { id: string; name: string }[];
  groups: { id: string; name: string; memberIds: string[] }[];
  groupAssignmentEnabled: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState("student");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const visibleGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    const filtered = term ? groups.filter((group) => group.name.toLowerCase().includes(term)) : groups;
    return selectedGroup && !filtered.some((group) => group.id === selectedGroup.id)
      ? [selectedGroup, ...filtered]
      : filtered;
  }, [groupSearch, groups, selectedGroup]);

  const groupInputValue = groupOpen || groupSearch.trim() ? groupSearch : selectedGroup?.name ?? "";

  async function assign() {
    const group = groups.find((g) => g.id === groupId);
    const studentIds = groupAssignmentEnabled && target === "group" ? group?.memberIds ?? [] : [studentId];
    if (studentIds.length === 0) {
      setError("Select at least one student.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/full-practice-tests/${testId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds, dueDate: dueDate || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to assign exam.");
      const changed = (Number(data.created) || 0) + (Number(data.reassigned) || 0) + (Number(data.updated) || 0);
      if (changed === 0) {
        setError("Nothing changed: this exam is already pending with this due date.");
        setLoading(false);
        return;
      }
      const firstStudentId = studentIds[0];
      router.push(
        firstStudentId
          ? `/teacher/students/${firstStudentId}?area=mocks`
          : "/teacher/practice-sets?area=mocks"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign exam.");
      setLoading(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <Select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="student">Student</option>
        {groupAssignmentEnabled && <option value="group">Group</option>}
      </Select>
      {target === "student" ? (
        <StudentPicker mode="single" students={students} value={studentId} onChange={setStudentId} />
      ) : (
        <div className="relative space-y-2">
          <p className="text-xs font-medium text-gray-500">Group</p>
          <Input
            value={groupInputValue}
            placeholder="Search group..."
            className="text-sm"
            onFocus={() => {
              setGroupOpen(true);
              setGroupSearch("");
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setGroupOpen(false);
                setGroupSearch("");
              }, 150);
            }}
            onChange={(event) => {
              setGroupSearch(event.target.value);
              setGroupOpen(true);
            }}
          />
          {groupOpen ? (
            <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-sm">
              {visibleGroups.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">No groups match the current search.</li>
              ) : (
                visibleGroups.map((group) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-sm",
                        group.id === groupId ? "font-medium text-blue-700" : "text-gray-800 hover:bg-gray-50",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setGroupId(group.id);
                        setGroupSearch(group.name);
                        setGroupOpen(false);
                      }}
                    >
                      {group.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button onClick={assign} disabled={loading}>
        {loading ? "Assigning..." : "Assign Exam"}
      </Button>
    </Card>
  );
}
