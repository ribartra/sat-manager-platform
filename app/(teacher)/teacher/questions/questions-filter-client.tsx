"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
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
    // The shared FilterBar (client-side because of the cascading skill picker).
    <FilterBar onSubmit={apply}>
      <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} allowAll fixedSection={sectionLabel} inFilterBar />
      <FilterField label="Search" htmlFor="qf-q">
        <div className="relative">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input id="qf-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search question text" className="pl-8" />
        </div>
      </FilterField>
      <FilterField label="Difficulty" htmlFor="qf-difficulty">
        <Select id="qf-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">All difficulties</option>
          {difficultyOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterField label="Status" htmlFor="qf-status">
        <Select id="qf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {questionStatusOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterActions clearHref={topicId || difficulty || status || query ? `/teacher/questions?area=${area}` : null} />
    </FilterBar>
  );
}
