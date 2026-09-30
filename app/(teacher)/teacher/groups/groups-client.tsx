"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StudentPicker } from "@/components/student-picker";
import { Plus, UserMinus } from "lucide-react";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

interface Member {
  id: string;
  name: string;
  email: string;
}
interface Group {
  id: string;
  name: string;
  schedule: string | null;
  members: Member[];
}

export function GroupsClient({ groups: initialGroups, students }: { groups: Group[]; students: Member[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const visibleGroups = groups.filter((group) => {
    const term = groupSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      group.name.toLowerCase().includes(term) ||
      group.members.some(
        (member) => member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term),
      )
    );
  });

  async function createGroup() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, schedule: newSchedule }),
    });
    const g = await res.json();
    setGroups((prev) => [...prev, { ...g, members: [] }]);
    setNewName("");
    setNewSchedule("");
    setCreating(false);
  }

  async function addMember(groupId: string, userId: string) {
    await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
  }

  async function removeMember(groupId: string, userId: string) {
    await fetch(`/api/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    router.refresh();
  }

  function startEdit(group: Group) {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditSchedule(group.schedule ?? "");
  }

  async function saveGroup(groupId: string) {
    try {
      await apiFetch(`/api/groups/${groupId}`, { method: "PATCH", json: { name: editName, schedule: editSchedule }, fallback: "Could not update group." });
    } catch (error) {
      notify.error(error);
      return;
    }
    setEditingGroupId(null);
    router.refresh();
  }

  async function deleteGroup(groupId: string) {
    const ok = await confirm({ title: "Delete this group?", description: "Members will be unlinked from the group.", tone: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await apiFetch(`/api/groups/${groupId}`, { method: "DELETE", fallback: "Could not delete group." });
    } catch (error) {
      notify.error(error);
      return;
    }
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">New Group</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group A" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">Schedule (optional)</label>
              <Input value={newSchedule} onChange={(e) => setNewSchedule(e.target.value)} placeholder="Mon/Wed 9am" />
            </div>
            <Button onClick={createGroup} disabled={creating} disabledReason={!newName.trim() ? "Enter a group name." : null} className="flex items-center gap-1">
              <Plus size={14} /> Create
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Input
          value={groupSearch}
          onChange={(event) => setGroupSearch(event.target.value)}
          placeholder="Search group or member..."
          className="max-w-sm"
        />
        <Input
          value={studentSearch}
          onChange={(event) => setStudentSearch(event.target.value)}
          placeholder="Search student to add..."
          className="max-w-sm"
        />
      </div>

      {visibleGroups.map((group) => {
        const excludeIds = group.members.map((m) => m.id);
        return (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {editingGroupId === group.id ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Group name" />
                      <Input
                        value={editSchedule}
                        onChange={(event) => setEditSchedule(event.target.value)}
                        placeholder="Schedule"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="font-semibold text-gray-900">{group.name}</h2>
                      {group.schedule && <p className="mt-0.5 text-xs text-gray-500">{group.schedule}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {group.members.length} student{group.members.length !== 1 ? "s" : ""}
                  </span>
                  {editingGroupId === group.id ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => saveGroup(group.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingGroupId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(group)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteGroup(group.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="mb-3 space-y-2">
                {group.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="ml-2 text-gray-400">{m.email}</span>
                    </div>
                    <button
                      onClick={() => removeMember(group.id, m.id)}
                      className="text-gray-400 transition-colors hover:text-red-500"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
                {group.members.length === 0 && <p className="text-sm text-gray-400">No members yet.</p>}
              </div>

              <div className="border-t border-gray-100 pt-3">
                <StudentPicker
                  mode="add"
                  label="Add student"
                  students={students}
                  excludeIds={excludeIds}
                  filterBy="nameEmail"
                  search={studentSearch}
                  onSearchChange={setStudentSearch}
                  showSearch={false}
                  onAdd={(studentId) => addMember(group.id, studentId)}
                  emptyLabel={
                    excludeIds.length === students.length
                      ? "All students are already in this group."
                      : "No students match the current search."
                  }
                />
              </div>
            </CardBody>
          </Card>
        );
      })}

      {visibleGroups.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          {groups.length === 0 ? "No groups yet. Create your first one above." : "No groups match the current search."}
        </p>
      )}
    </div>
  );
}
