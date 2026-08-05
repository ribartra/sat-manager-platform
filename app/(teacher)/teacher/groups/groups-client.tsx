"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Plus, Tag, UserMinus, UserPlus } from "lucide-react";

interface Member { id: string; name: string; email: string }
interface Group { id: string; name: string; schedule: string | null; members: Member[] }

export function GroupsClient({ groups: initialGroups, students }: { groups: Group[]; students: Member[] }) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [showAllAvailable, setShowAllAvailable] = useState<Record<string, boolean>>({});
  const [groupSearch, setGroupSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const visibleGroups = groups.filter((group) => {
    const term = groupSearch.trim().toLowerCase();
    if (!term) return true;
    return group.name.toLowerCase().includes(term) || group.members.some((member) => member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term));
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
    const response = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, schedule: editSchedule }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || "Could not update group.");
      return;
    }
    setEditingGroupId(null);
    router.refresh();
  }

  async function deleteGroup(groupId: string) {
    if (!window.confirm("Delete this group? Members will be unlinked from the group.")) return;
    const response = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || "Could not delete group.");
      return;
    }
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Create group */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">New Group</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Group A" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Schedule (optional)</label>
              <Input value={newSchedule} onChange={(e) => setNewSchedule(e.target.value)} placeholder="Mon/Wed 9am" />
            </div>
            <Button onClick={createGroup} disabled={creating || !newName.trim()} className="flex items-center gap-1">
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

      {/* Groups list */}
      {visibleGroups.map((group) => {
        const membersSet = new Set(group.members.map((m) => m.id));
        const available = students.filter((s) => {
          const term = studentSearch.trim().toLowerCase();
          return !membersSet.has(s.id) && (!term || s.name.toLowerCase().includes(term) || s.email.toLowerCase().includes(term));
        });
        const MAX_VISIBLE = 5;
        const showAll = showAllAvailable[group.id] ?? false;
        const visibleAvailable = showAll ? available : available.slice(0, MAX_VISIBLE);
        const hiddenCount = available.length - MAX_VISIBLE;

        return (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {editingGroupId === group.id ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Group name" />
                      <Input value={editSchedule} onChange={(event) => setEditSchedule(event.target.value)} placeholder="Schedule" />
                    </div>
                  ) : (
                    <>
                      <h2 className="font-semibold text-gray-900">{group.name}</h2>
                      {group.schedule && <p className="text-xs text-gray-500 mt-0.5">{group.schedule}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{group.members.length} student{group.members.length !== 1 ? "s" : ""}</span>
                  {editingGroupId === group.id ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => saveGroup(group.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingGroupId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(group)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteGroup(group.id)}>Delete</Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 mb-3">
                {group.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="text-gray-400 ml-2">{m.email}</span>
                    </div>
                    <button
                      onClick={() => removeMember(group.id, m.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
                {group.members.length === 0 && <p className="text-sm text-gray-400">No members yet.</p>}
              </div>

              {available.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Add student</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleAvailable.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addMember(group.id, s.id)}
                        className="flex items-center gap-1 text-xs rounded-full border border-gray-200 px-3 py-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                      >
                        <UserPlus size={10} /> {s.name}
                      </button>
                    ))}
                    {!showAll && hiddenCount > 0 && (
                      <button
                        onClick={() => setShowAllAvailable((prev) => ({ ...prev, [group.id]: true }))}
                        className="flex items-center gap-1 text-xs rounded-full border border-dashed border-gray-300 px-3 py-1 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        <Tag size={10} /> View all ({hiddenCount} more)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}

      {visibleGroups.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          {groups.length === 0 ? "No groups yet. Create your first one above." : "No groups match the current search."}
        </p>
      )}
    </div>
  );
}
