"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Select } from "@/components/ui/select";
import { TaxonomyPicker, type TaxonomyPickerTopic } from "@/components/taxonomy-picker";
import { difficultyOptions, questionStatusOptions } from "@/lib/domain-meta";

export function QuestionsFilter({
  area,
  sectionLabel,
  topics,
  initialTopicId,
  initialDomainId,
  initialDifficulty,
  initialStatus,
  pageSize,
}: {
  area: string;
  /** Rows per page chosen in the pager (kept when the filters change). */
  pageSize: number;
  sectionLabel: string;
  topics: TaxonomyPickerTopic[];
  initialTopicId?: string;
  /** Domain chosen with no skill (`domain` in the URL). */
  initialDomainId?: string;
  initialDifficulty?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const initialDomainName = topics.find((t) => t.domainId === initialDomainId)?.domainName ?? "";
  const [domainName, setDomainName] = useState(initialDomainName);
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("area", area);
    // The skill's domain comes with it; a domain alone narrows to its skills.
    const domainId = topics.find((t) => (topicId ? t.id === topicId : t.domainName === domainName))?.domainId;
    if (domainId && (topicId || domainName)) params.set("domain", domainId);
    if (topicId) params.set("topic", topicId);
    if (difficulty) params.set("difficulty", difficulty);
    if (status) params.set("status", status);
    params.set("per", String(pageSize));
    router.push(`/teacher/questions?${params.toString()}`);
  }

  return (
    // The shared FilterBar (client-side because of the cascading skill picker).
    <FilterBar onSubmit={apply}>
      <TaxonomyPicker topics={topics} value={topicId} onChange={setTopicId} allowAll fixedSection={sectionLabel} inFilterBar initialDomain={initialDomainName} onDomainChange={setDomainName} />
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
      <FilterActions clearHref={topicId || domainName || difficulty || status ? `/teacher/questions?area=${area}&per=${pageSize}` : null} />
    </FilterBar>
  );
}
