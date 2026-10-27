"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TaxonomyPicker, type TaxonomyPickerTopic } from "@/components/taxonomy-picker";
import { difficultyOptions, questionStatusOptions } from "@/lib/domain-meta";

export function QuestionsFilter({
  area,
  sectionLabel,
  topics,
  initialTopicId,
  initialDifficulty,
  initialStatus,
  initialQuery,
}: {
  area: string;
  initialQuery?: string;
  sectionLabel: string;
  topics: TaxonomyPickerTopic[];
  initialTopicId?: string;
  initialDifficulty?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [query, setQuery] = useState(initialQuery ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("area", area);
    if (topicId) params.set("topic", topicId);
    if (difficulty) params.set("difficulty", difficulty);
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    router.push(`/teacher/questions?${params.toString()}`);
  }

  return (
    <form onSubmit={apply} className="mb-5 space-y-3">
      <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} allowAll fixedSection={sectionLabel} />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search question text or ID"
          aria-label="Search questions"
          className="max-w-xs text-sm"
        />
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="text-sm">
          <option value="">All difficulties</option>
          {difficultyOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm">
          <option value="">All statuses</option>
          {questionStatusOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <button type="submit" className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Filter
        </button>
      </div>
    </form>
  );
}
