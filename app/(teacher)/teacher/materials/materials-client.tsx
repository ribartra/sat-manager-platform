"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaxonomyPicker, type TaxonomyPickerTopic } from "@/components/taxonomy-picker";

type TopicOption = TaxonomyPickerTopic;

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  body: string | null;
  url: string | null;
  status: string;
  topicId: string | null;
  topic: { name: string; domainName: string; sectionLabel: string } | null;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "default"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "default",
};

function SkillLine({ topic }: { topic: MaterialRow["topic"] }) {
  if (!topic) return <span className="text-xs text-gray-400">General</span>;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{topic.sectionLabel} · {topic.domainName}</p>
      <p className="text-sm font-medium text-gray-700">{topic.name}</p>
    </div>
  );
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewing, setViewing] = useState<MaterialRow | null>(null);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setBody("");
    setUrl("");
    setTopicId("");
    setStatusValue("PUBLISHED");
  }

  function openNew() {
    resetForm();
    setEditorOpen(true);
  }

  function openEdit(material: MaterialRow) {
    setEditingId(material.id);
    setTitle(material.title);
    setDescription(material.description ?? "");
    setBody(material.body ?? "");
    setUrl(material.url ?? "");
    setTopicId(material.topicId ?? "");
    setStatusValue(material.status);
    setEditorOpen(true);
  }

  async function saveMaterial() {
    setSaving(true);
    const response = await fetch(editingId ? `/api/materials/${editingId}` : "/api/materials", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, body, url, topicId, status }),
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error || "Could not save material.");
      return;
    }
    setEditorOpen(false);
    resetForm();
    router.refresh();
  }

  async function setStatus(materialId: string, next: string) {
    await fetch(`/api/materials/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
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
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">{materials.length} material{materials.length === 1 ? "" : "s"}</p>
        <Button onClick={openNew} className="flex items-center gap-1.5">
          <Plus size={15} /> New material
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card padding="lg" className="py-16 text-center text-gray-400">
          <p>No study materials yet.</p>
          <button onClick={openNew} className="mt-2 text-sm text-blue-600 hover:underline">Create the first one →</button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => (
            <Card key={material.id} padding="md" className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <SkillLine topic={material.topic} />
                <Badge variant={STATUS_VARIANT[material.status] ?? "default"}>{material.status}</Badge>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{material.title}</h3>
              {material.description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{material.description}</p>}
              {material.url && (
                <p className="mt-2 flex items-center gap-1 truncate text-xs text-blue-600">
                  <ExternalLink size={12} /> <span className="truncate">{material.url}</span>
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
                <Button variant="secondary" size="sm" onClick={() => setViewing(material)}>Ver</Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(material)}>Edit</Button>
                {material.status !== "PUBLISHED" && (
                  <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "PUBLISHED")}>Publish</Button>
                )}
                {material.status !== "DRAFT" && (
                  <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "DRAFT")}>Draft</Button>
                )}
                {material.status !== "ARCHIVED" && (
                  <Button variant="ghost" size="sm" onClick={() => setStatus(material.id, "ARCHIVED")}>Archive</Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => duplicateMaterial(material.id)}>Duplicate</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMaterial(material.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit material" : "New material"}</DialogTitle>
            <DialogDescription>Publish theory notes and support links for students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Reference URL or file link" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Skill (optional)</label>
              <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} stacked />
              <p className="mt-1 text-xs text-gray-400">Leave empty for a general material.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <Select value={status} onChange={(e) => setStatusValue(e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Theory notes or instructions" rows={8} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveMaterial} disabled={saving || !title.trim()}>
              {saving ? "Saving..." : editingId ? "Save material" : "Create material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View modal */}
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[viewing.status] ?? "default"}>{viewing.status}</Badge>
                  <SkillLine topic={viewing.topic} />
                </div>
                <DialogTitle className="mt-1">{viewing.title}</DialogTitle>
                {viewing.description && <DialogDescription>{viewing.description}</DialogDescription>}
              </DialogHeader>
              {viewing.url && (
                <a
                  href={viewing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink size={14} /> {viewing.url}
                </a>
              )}
              {viewing.body ? (
                <MathContent content={viewing.body} className="text-sm leading-relaxed text-gray-800" />
              ) : (
                <p className="text-sm text-gray-400">No content body.</p>
              )}
              <DialogFooter>
                <Button variant="secondary" onClick={() => { const m = viewing; setViewing(null); if (m) openEdit(m); }}>Edit</Button>
                <Button onClick={() => setViewing(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
