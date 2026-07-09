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
  const [showAllAvailable, setShowAllAvailable] = useState<Record<string, boolean>>({});

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

      {/* Groups list */}
      {groups.map((group) => {
        const membersSet = new Set(group.members.map((m) => m.id));
        const available = students.filter((s) => !membersSet.has(s.id));
        const MAX_VISIBLE = 5;
        const showAll = showAllAvailable[group.id] ?? false;
        const visibleAvailable = showAll ? available : available.slice(0, MAX_VISIBLE);
        const hiddenCount = available.length - MAX_VISIBLE;

        return (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{group.name}</h2>
                  {group.schedule && <p className="text-xs text-gray-500 mt-0.5">{group.schedule}</p>}
                </div>
                <span className="text-xs text-gray-400">{group.members.length} student{group.members.length !== 1 ? "s" : ""}</span>
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

      {groups.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No groups yet. Create your first one above.</p>
      )}
    </div>
  );
}
