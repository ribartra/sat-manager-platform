"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TopicOption {
  id: string;
  name: string;
}

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  status: string;
  topic: { name: string } | null;
}

export function MaterialsClient({ topics, materials }: { topics: TopicOption[]; materials: MaterialRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [topicId, setTopicId] = useState("");
  const [saving, setSaving] = useState(false);

  async function createMaterial() {
    setSaving(true);
    await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, body, url, topicId, status: "PUBLISHED" }),
    });
    setTitle("");
    setDescription("");
    setBody("");
    setUrl("");
    setTopicId("");
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

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">New material</h2>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short description" />
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Reference URL or file link" />
          <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">No topic</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </Select>
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Theory notes or instructions" rows={8} />
          <Button onClick={createMaterial} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Publish material"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Topic</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStatus(material.id, material.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED")}
                  >
                    {material.status === "PUBLISHED" ? "Archive" : "Publish"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
