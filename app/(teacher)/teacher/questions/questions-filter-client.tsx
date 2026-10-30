"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Select } from "@/components/ui/select";
import { TaxonomyPicker, type TaxonomyPickerTopic } from "@/components/taxonomy-picker";
import { QUESTION_STATUS_DEFAULT, difficultyOptions, questionStatusOptions } from "@/lib/domain-meta";

export function QuestionsFilter({
  area,
  sectionLabel,
  topics,
  initialTopicId,
  initialDomainId,
  initialDifficulty,
  initialStatus,
  pager,
}: {
  area: string;
  sectionLabel: string;
  topics: TaxonomyPickerTopic[];
  initialTopicId?: string;
  /** Domain chosen with no skill (`domain` in the URL). */
  initialDomainId?: string;
  initialDifficulty?: string;
  /** The URL's status: missing = Published, "all" = every status. */
  initialStatus?: string;
  /** Compact page navigation, kept on screen with the filters. */
  pager?: React.ReactNode;
}) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const initialDomainName = topics.find((t) => t.domainId === initialDomainId)?.domainName ?? "";
  const [domainName, setDomainName] = useState(initialDomainName);
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [status, setStatus] = useState(initialStatus || QUESTION_STATUS_DEFAULT);

  function href() {
    const params = new URLSearchParams();
    params.set("area", area);
    // The skill's domain comes with it; a domain alone narrows to its skills.
    const domainId = topics.find((t) => (topicId ? t.id === topicId : t.domainName === domainName))?.domainId;
    if (domainId && (topicId || domainName)) params.set("domain", domainId);
    if (topicId) params.set("topic", topicId);
    if (difficulty) params.set("difficulty", difficulty);
    if (status !== QUESTION_STATUS_DEFAULT) params.set("status", status);
    return `/teacher/questions?${params.toString()}`;
  }

  // The filters apply as soon as a value is chosen (the columns follow at once); one navigation even
  // when the skill picker changes the domain and the skill together.
  const lastHref = useRef<string | null>(null);
  const next = href();
  useEffect(() => {
    if (lastHref.current === null) {
      lastHref.current = next;
      return;
    }
    if (next === lastHref.current) return;
    lastHref.current = next;
    router.push(next);
  }, [next, router]);

  return (
    // The shared FilterBar (client-side because of the cascading skill picker).
    <FilterBar pager={pager} onSubmit={(e) => { e.preventDefault(); router.push(next); }}>
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
          <option value="all">All statuses</option>
          {questionStatusOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FilterField>
      <FilterActions applyButton={false} clearHref={topicId || domainName || difficulty || status !== QUESTION_STATUS_DEFAULT ? `/teacher/questions?area=${area}` : null} />
    </FilterBar>
  );
}
