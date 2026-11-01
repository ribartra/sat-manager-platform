"use client";

import { useEffect, useRef, useState } from "react";
import { SearchableSelect } from "@/components/sat/searchable-select";
import { useRouter } from "next/navigation";
import { FilterActions, FilterBar, FilterField, SEARCHABLE_MIN_OPTIONS } from "@/components/sat/filter-bar";
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
  const next = href();
  useApplyOnChange(next);

  return (
    // The shared FilterBar (client-side because of the cascading skill picker).
    <FilterBar onSubmit={(e) => { e.preventDefault(); router.push(next); }}>
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

/** Navigates once each time `href` changes (not on mount): the filters apply as soon as a value is chosen. */
function useApplyOnChange(href: string) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === null) {
      last.current = href;
      return;
    }
    if (href === last.current) return;
    last.current = href;
    router.push(href);
  }, [href, router]);
}

/** Tests tab of the Question Bank: Test, module, difficulty and status (applied on change). */
export function QuestionsTestFilter({
  tests,
  modules,
  initialTestId,
  initialModule,
  initialDifficulty,
  initialStatus,
}: {
  tests: { value: string; label: string }[];
  modules: { value: string; label: string }[];
  initialTestId?: string;
  initialModule?: string;
  initialDifficulty?: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [testId, setTestId] = useState(initialTestId ?? "");
  const [module, setModule] = useState(initialModule ?? "");
  const [difficulty, setDifficulty] = useState(initialDifficulty ?? "");
  const [status, setStatus] = useState(initialStatus || QUESTION_STATUS_DEFAULT);
  const params = new URLSearchParams({ area: "tests" });
  if (testId) params.set("test", testId);
  if (module) params.set("module", module);
  if (difficulty) params.set("difficulty", difficulty);
  if (status !== QUESTION_STATUS_DEFAULT) params.set("status", status);
  const next = `/teacher/questions?${params.toString()}`;
  useApplyOnChange(next);

  return (
    <FilterBar onSubmit={(e) => { e.preventDefault(); router.push(next); }}>
      <FilterField label="Test" htmlFor="qf-test">
        {tests.length > SEARCHABLE_MIN_OPTIONS ? (
          <SearchableSelect id="qf-test" value={testId} onChange={setTestId} allLabel="All Tests" options={tests} searchPlaceholder="Search Tests" />
        ) : (
          <Select id="qf-test" value={testId} onChange={(e) => setTestId(e.target.value)}>
            <option value="">All Tests</option>
            {tests.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        )}
      </FilterField>
      <FilterField label="Module" htmlFor="qf-module">
        <Select id="qf-module" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">All modules</option>
          {modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
      </FilterField>
      <FilterField label="Difficulty" htmlFor="qf-difficulty">
        <Select id="qf-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">All difficulties</option>
          {difficultyOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </Select>
      </FilterField>
      <FilterField label="Status" htmlFor="qf-status">
        <Select id="qf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {questionStatusOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </Select>
      </FilterField>
      <FilterActions applyButton={false} clearHref={testId || module || difficulty || status !== QUESTION_STATUS_DEFAULT ? "/teacher/questions?area=tests" : null} />
    </FilterBar>
  );
}
