"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface TopicOption {
  id: string;
  name: string;
}

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  body: string | null;
  url: string | null;
  status: string;
  topicId: string | null;
  topic: { name: string } | null;
}

export function MaterialsClient({ topics, materials }: { topics: TopicOption[]; materials: MaterialRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [topicId, setTopicId] = useState("");
  const [status, setStatusValue] = useState("PUBLISHED");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadForEdit(material: MaterialRow) {
    setEditingId(material.id);
    setTitle(material.title);
    setDescription(material.description ?? "");
    setBody(material.body ?? "");
    setUrl(material.url ?? "");
    setTopicId(material.topicId ?? "");
    setStatusValue(material.status);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setBody("");
    setUrl("");
    setTopicId("");
    setStatusValue("PUBLISHED");
  }

  async function saveMaterial() {
    setSaving(true);
    await fetch(editingId ? `/api/materials/${editingId}` : "/api/materials", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, body, url, topicId, status }),
    });
    resetForm();
    setSaving(false);
    router.refresh();
  }

  async function setStatus(materialId: string, status: string) {
    await fetch(`/api/materials/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function duplicateMaterial(materialId: string) {
    const response = await fetch(`/api/materials/${materialId}/duplicate`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) window.alert(data.error || "Could not duplicate material.");
    router.refresh();
  }

  async function deleteMaterial(materialId: string) {
    if (!window.confirm("Delete this study material? This cannot be undone.")) return;
    const response = await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) window.alert(data.error || "Could not delete material.");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card padding="md">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{editingId ? "Edit material" : "New material"}</h2>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" />
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Reference URL or file link" />
          <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">No skill</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatusValue(event.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Theory notes or instructions" rows={8} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveMaterial} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : editingId ? "Save material" : "Create material"}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Skill</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {materials.map((material) => (
              <tr key={material.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{material.title}</p>
                  <p className="text-xs text-gray-500">{material.description}</p>
                  {material.url && <p className="text-xs text-blue-600">{material.url}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{material.topic?.name ?? "General"}</td>
                <td className="px-4 py-3 text-gray-600">{material.status}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => loadForEdit(material)}>Edit</Button>
                    {material.status !== "PUBLISHED" && <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "PUBLISHED")}>Publish</Button>}
                    {material.status !== "DRAFT" && <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "DRAFT")}>Draft</Button>}
                    {material.status !== "ARCHIVED" && <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "ARCHIVED")}>Archive</Button>}
                    <Button variant="ghost" size="sm" onClick={() => duplicateMaterial(material.id)}>Duplicate</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMaterial(material.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
