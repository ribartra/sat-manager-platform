"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TaxonomyPickerTopic {
  id: string;
  name: string;
  sectionLabel: string;
  domainName: string;
}

// Preferred display order for sections; anything else falls after these.
const SECTION_ORDER = ["Mathematics", "Reading & Writing"];

/**
 * Cascading Section -> Domain -> Skill picker over the taxonomy, replacing flat
 * dropdowns that listed every skill as a concatenated "Section / Domain / Skill"
 * string. The selected value is the skill (Topic) id.
 *
 * - `allowAll`: adds "All ..." entries and lets the value be empty (for filters).
 * - `fixedSection`: hide the Section select and scope to that section (e.g. when
 *   a page already has section tabs).
 */
export function TaxonomyPicker({
  topics,
  value,
  onChange,
  required = false,
  allowAll = false,
  fixedSection,
  className,
}: {
  topics: TaxonomyPickerTopic[];
  value: string;
  onChange: (topicId: string) => void;
  required?: boolean;
  allowAll?: boolean;
  fixedSection?: string;
  className?: string;
}) {
  const selected = topics.find((t) => t.id === value);
  const [sectionState, setSectionState] = useState(selected?.sectionLabel ?? "");
  const [domainState, setDomainState] = useState(selected?.domainName ?? "");

  const section = fixedSection ?? sectionState;
  const req = required && !allowAll;

  const sectionOptions = useMemo(() => {
    const set = new Set(topics.map((t) => t.sectionLabel));
    return [...SECTION_ORDER.filter((s) => set.has(s)), ...[...set].filter((s) => !SECTION_ORDER.includes(s))];
  }, [topics]);
  const domainOptions = useMemo(
    () => Array.from(new Set(topics.filter((t) => t.sectionLabel === section).map((t) => t.domainName))),
    [topics, section]
  );
  const skillOptions = useMemo(
    () => topics.filter((t) => t.sectionLabel === section && t.domainName === domainState),
    [topics, section, domainState]
  );

  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className={cn("grid gap-3", fixedSection ? "grid-cols-2" : "grid-cols-3", className)}>
      {!fixedSection && (
        <div>
          <label className={labelCls}>Section{req ? " *" : ""}</label>
          <Select
            value={sectionState}
            onChange={(e) => {
              setSectionState(e.target.value);
              setDomainState("");
              onChange("");
            }}
            required={req}
          >
            <option value="">{allowAll ? "All sections" : "Select a section..."}</option>
            {sectionOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <label className={labelCls}>Domain{req ? " *" : ""}</label>
        <Select
          value={domainState}
          onChange={(e) => {
            setDomainState(e.target.value);
            onChange("");
          }}
          required={req}
          disabled={!section}
        >
          <option value="">{!section ? "Select a section first" : allowAll ? "All domains" : "Select a domain..."}</option>
          {domainOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className={labelCls}>Skill{req ? " *" : ""}</label>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={req}
          disabled={!domainState}
        >
          <option value="">{allowAll ? "All skills" : !domainState ? "Select a domain first" : "Select a skill..."}</option>
          {skillOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}
