"use client";

import { Checkbox, Radio } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignmentStatusLabel, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { SkillsSourceMap, DIFFICULTIES, type SkillsMapChip, type SkillsSourceSkill } from "@/components/sat/skills-map";
import { InlineError } from "@/components/sat/alert";
import { AssignSummaryCard, defaultAssignOptions, type AssignOptions } from "@/components/sat/assign-summary-card";
import { errorMessage, readApiError } from "@/lib/api-client";
import { type AssignmentContext } from "@/lib/assignment-context";
import { ContextToggle } from "@/components/sat/context-tabs";
import { AssignStep } from "@/components/sat/assign-step";
import { FilterBar, FilterField } from "@/components/sat/filter-bar";
import { SearchableSelect } from "@/components/sat/searchable-select";

interface PracticeSetInfo {
  id: string;
  name: string;
  difficulty: string;
  topicName: string;
  topicId: string;
  /** Official domain order (lib/taxonomy-order.ts); skills are listed A–Z inside each domain. */
  domainOrder: number;
  domainId: string;
  domainName: string;
  sourceId: string;
  sourceName: string;
  sourceOrder: number;
  practiceArea: PracticeAreaCode | null;
  questionCount: number;
  /** Contexts the student already has it in: in those it shows "ALREADY ASSIGNED" and can't be picked. */
  assignedIn: AssignmentContext[];
}

/** A set the student already has, opened from "Edit" to change its dates/settings (never re-assigned). */
interface EditingSetInfo {
  id: string;
  name: string;
  difficulty: string;
  status: string;
  dueDate: string | null;
  unlockAt: string | null;
  feedbackMode: "AFTER_SET" | "IMMEDIATE";
  showExplanations: boolean;
  /** Fixed once assigned: shown, never changed. */
  context: AssignmentContext;
}

const AREAS: Array<{ key: "math" | "reading" | "writing"; code: PracticeAreaCode }> = [
  { key: "math", code: "MATH" },
  { key: "reading", code: "READING" },
  { key: "writing", code: "WRITING" },
];

interface GroupMember {
  id: string;
  name: string;
}

interface GroupInfo {
  id: string;
  name: string;
  members: GroupMember[];
}

interface AssignFormProps {
  studentId: string;
  studentName: string;
  /** Every assignable set; the ones the student already has come with `assigned` (shown, not selectable). */
  practiceSets: PracticeSetInfo[];
  /** Non-empty = edit mode: change the settings of these already-assigned sets. */
  editing?: EditingSetInfo[];
  groups: GroupInfo[];
  groupAssignmentEnabled: boolean;
  /** Admin › Settings → "Keep it locked" option (ASSIGN_LOCKED_OPTION). */
  lockOptionEnabled?: boolean;
  /** Practice area shown (from the URL: the Assign view's area tabs are links). */
  area: "math" | "reading" | "writing";
  /** Sets preselected from the URL (`set=`), e.g. "Assign" in Practice › By skill. */
  initialSelected?: string[];
  /** Skill opened from the URL (`topic=`, or the preselected set's skill). */
  openSkillId?: string;
  /** Math / Reading / Writing / Tests tabs (links), shown in the "Choose what to assign" step. */
  areaTabs?: React.ReactNode;
  /** Classroom / Homework already chosen (`context=` in the URL, kept when switching area). */
  initialContext?: AssignmentContext;
}

export function AssignForm({
  studentId,
  studentName,
  practiceSets,
  editing = [],
  groups,
  groupAssignmentEnabled,
  lockOptionEnabled = false,
  area,
  initialSelected = [],
  openSkillId,
  areaTabs,
  initialContext,
}: AssignFormProps) {
  const router = useRouter();
  const editMode = editing.length > 0;
  const [target, setTarget] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  // Classroom or Homework: always chosen by the teacher (no default); fixed when editing; groups are Homework.
  const [chosenContext, setChosenContext] = useState<AssignmentContext | null>(editing[0]?.context ?? initialContext ?? null);
  const context: AssignmentContext | null = editMode ? editing[0].context : target === "group" ? "HOMEWORK" : chosenContext;
  // Already taken in the chosen tab: Homework = it has it as Homework; Classroom = it has it in Classroom
  // or as Homework (after Homework, Classroom is closed for that set).
  const isAssigned = (ps: PracticeSetInfo) =>
    context === "CLASSROOM" ? ps.assignedIn.length > 0 : context ? ps.assignedIn.includes(context) : ps.assignedIn.length >= 2;
  const inHomeworkOnly = (ps: PracticeSetInfo) => context === "CLASSROOM" && ps.assignedIn.includes("HOMEWORK");
  function chooseContext(next: AssignmentContext) {
    setChosenContext(next);
    // In the URL too, so the Math / Reading / Writing tabs keep it.
    const url = new URL(window.location.href);
    url.searchParams.set("context", next);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
    // Switching tabs drops the selected sets that are already taken in the new one.
    setSelected((prev) => new Set([...prev].filter((id) => !practiceSets.some((ps) => ps.id === id && (next === "CLASSROOM" ? ps.assignedIn.length > 0 : ps.assignedIn.includes(next))))));
  }
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...editing.map((set) => set.id), ...initialSelected.filter((id) => practiceSets.some((ps) => ps.id === id && ps.assignedIn.length < 2))]),
  );
  // Due date one week from today, open today, answers at the end, explanations off; editing starts
  // from the set's stored settings.
  const [options, setOptions] = useState<AssignOptions>(() => defaultAssignOptions(7, editing[0]));
  const [lockOnAssign, setLockOnAssign] = useState(false);
  // Step 4 filters (no search box): skill, assignment status in the chosen tab, source; "All" by default.
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "available" | "assigned">("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllMembers, setShowAllMembers] = useState(false);

  const areaCode = AREAS.find((a) => a.key === area)!.code;
  const filtering = Boolean(skillFilter || statusFilter || sourceFilter);
  // The filter options: the area's skills (A–Z) and sources.
  const areaAll = practiceSets.filter((ps) => ps.practiceArea === areaCode);
  const skillOptions = [...new Map(areaAll.map((ps) => [ps.topicId, ps.topicName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "en", { numeric: true, sensitivity: "base" }))
    .map(([value, label]) => ({ value, label }));
  const sourceOptions = [...new Map(areaAll.map((ps) => [ps.sourceId, { name: ps.sourceName, order: ps.sourceOrder }])).entries()]
    .sort((a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name))
    .map(([value, source]) => ({ value, label: source.name }));
  // The By-skill cards (same component as Practice › By skill): domains in official order, skills A–Z;
  // a skill opens to one row per source with one toggle chip per set the student doesn't have yet.
  const domains = useMemo(() => {
    const areaSets = practiceSets.filter(
      (ps) =>
        ps.practiceArea === areaCode &&
        (!skillFilter || ps.topicId === skillFilter) &&
        (!sourceFilter || ps.sourceId === sourceFilter) &&
        (!statusFilter || (statusFilter === "assigned") === isAssigned(ps)),
    );
    const byDomain = new Map<string, { id: string; name: string; order: number; skills: Map<string, { id: string; name: string; sets: PracticeSetInfo[] }> }>();
    for (const ps of areaSets) {
      const domain = byDomain.get(ps.domainId) ?? byDomain.set(ps.domainId, { id: ps.domainId, name: ps.domainName, order: ps.domainOrder, skills: new Map() }).get(ps.domainId)!;
      const skill = domain.skills.get(ps.topicId) ?? domain.skills.set(ps.topicId, { id: ps.topicId, name: ps.topicName, sets: [] }).get(ps.topicId)!;
      skill.sets.push(ps);
    }
    return [...byDomain.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map((domain) => ({
      id: domain.id,
      name: domain.name,
      skills: [...domain.skills.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" })),
    }));
    // isAssigned follows the chosen tab (context).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceSets, areaCode, skillFilter, sourceFilter, statusFilter, context]);
  const first = studentName.split(" ")[0];
  const backHref = `/teacher/students/${studentId}?area=${area}`;
  function toggleSelect(id: string) {
    // Already assigned in this context: never selected or cleared from here.
    if (practiceSets.some((ps) => ps.id === id && isAssigned(ps))) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAssign() {
    if (selected.size === 0) return;
    const group = groups.find((g) => g.id === groupId);
    const useGroup = groupAssignmentEnabled && target === "group";
    const studentIds = useGroup ? group?.members.map((m) => m.id) ?? [] : [studentId];
    if (studentIds.length === 0) return;
    setLoading(true);
    setError("");
    const response = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds,
        practiceSetIds: [...selected],
        sourceGroupId: useGroup ? groupId : null,
        dueDate: context === "CLASSROOM" ? null : options.dueDate || null,
        unlockAt: options.unlockAt || null,
        locked: lockOptionEnabled && lockOnAssign,
        feedbackMode: options.feedbackMode,
        showExplanations: options.showExplanations,
        context,
      }),
    });
    if (!response.ok) {
      setLoading(false);
      setSuccess(false);
      setError(errorMessage(await readApiError(response, "Unable to assign the selected practice sets.")));
      return;
    }
    const data = await response.json();
    setLoading(false);
    const created = Number(data.created) || 0;
    const updated = Number(data.updated) || 0;
    const reassigned = Number(data.reassigned) || 0;
    const classroomClosed = Number(data.classroomClosed) || 0;
    const blockedByHomework = Number(data.blockedByHomework) || 0;
    if (created + updated + reassigned === 0) {
      setSuccess(false);
      setError(
        blockedByHomework
          ? "Nothing changed: the selected sets are already Homework, so they can't be Classroom work any more."
          : "Nothing changed: the selected sets are already assigned with these settings.",
      );
      return;
    }
    setSuccessMessage(
      [
        created ? `${created} assigned` : null,
        reassigned ? `${reassigned} reassigned` : null,
        updated ? `${updated} updated` : null,
        classroomClosed ? `${classroomClosed} Classroom ${classroomClosed === 1 ? "set" : "sets"} closed (Homework starts from zero)` : null,
        blockedByHomework ? `${blockedByHomework} already Homework (not assigned as Classroom)` : null,
      ].filter(Boolean).join(" · "),
    );
    setSuccess(true);
    setError("");
    router.refresh();
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
      {/* "Assign to" only when there is a choice (groups on); editing lists what changes. */}
      {editMode || groupAssignmentEnabled ? (
      <Card padding="md">
        {editMode ? (
          <>
            <h2 className="text-sm font-semibold text-gray-900">Change the settings of what {first} already has</h2>
            <p className="mt-0.5 text-xs text-gray-500">The student keeps the progress and can retry as many times as needed; nothing is assigned again.</p>
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {editing.map((set) => (
                <li key={set.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-gray-800">{set.name}</span>
                  <span className="shrink-0 text-xs text-gray-500">{difficultyLabel(set.difficulty)} · {assignmentStatusLabel(set.status)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
        <>
        <label className="mb-2 block text-sm font-medium text-gray-700">Assign to</label>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <Radio checked={target === "student"} onChange={() => setTarget("student")} />
            This student
          </label>
          {groupAssignmentEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Radio checked={target === "group"} onChange={() => { setTarget("group"); setShowAllMembers(false); }} disabled={groups.length === 0} />
              Group
            </label>
          )}
          {target === "group" && (
            <Select value={groupId} onChange={(e) => { setGroupId(e.target.value); setShowAllMembers(false); }} className="max-w-xs">
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members.length} students)
                </option>
              ))}
            </Select>
          )}
        </div>
        {target === "group" && (() => {
          const group = groups.find((g) => g.id === groupId);
          if (!group || group.members.length === 0) return <p className="mt-2 text-xs text-gray-400">This group has no members yet.</p>;
          const MAX = 5;
          const visible = showAllMembers ? group.members : group.members.slice(0, MAX);
          const hiddenCount = group.members.length - MAX;
          return (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visible.map((m) => (
                <span key={m.id} className="inline-flex items-center text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                  {m.name}
                </span>
              ))}
              {!showAllMembers && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(true)}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2.5 py-0.5 hover:bg-gray-200 transition-colors"
                >
                  <Tag size={10} /> View all ({hiddenCount} more)
                </button>
              )}
            </div>
          );
        })()}
        </>
        )}
      </Card>
      ) : null}

      {/* Step 3: Classroom or Homework. Step 4: the sets (Practice › By skill cards). */}
      {editMode ? null : (
        <>
        <AssignStep n={3} title="Choose Classroom or Homework" hint="Classroom: work in class, not scored. Homework: scored; results and reports count only Homework.">
          <ContextToggle
            value={context}
            onChange={target === "group" ? undefined : chooseContext}
            fixedReason="Group assignments are Homework."
          />
        </AssignStep>
        <AssignStep n={4} title="Choose what to assign">
        {areaTabs}
        <div className="space-y-3">
          {!context ? (
            <p className="rounded-lg border border-dashed border-[var(--sat-border)] bg-white px-4 py-6 text-center text-sm text-[var(--sat-muted)]">
              Choose Classroom or Homework to pick sets.
            </p>
          ) : (
          <>
          <FilterBar sticky={false} className="mb-0">
            <FilterField label="Skill" htmlFor="assign-filter-skill">
              <SearchableSelect id="assign-filter-skill" options={skillOptions} allLabel="All" value={skillFilter} onChange={setSkillFilter} searchPlaceholder="Search skills" />
            </FilterField>
            <FilterField label="Assignment status" htmlFor="assign-filter-status">
              <Select id="assign-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "available" | "assigned")}>
                <option value="">All</option>
                <option value="available">Not assigned</option>
                <option value="assigned">{context === "CLASSROOM" ? "Already assigned or in Homework" : "Already assigned"}</option>
              </Select>
            </FilterField>
            <FilterField label="Source" htmlFor="assign-filter-source">
              <Select id="assign-filter-source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">All</option>
                {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </FilterBar>
          <p className="text-xs text-gray-500">
            {context === "HOMEWORK"
              ? <>Open a skill and pick sets by source and level. Sets {first} already has as Homework are grayed out (they can retry them any time); a level is marked Already assigned when every source is. A set done in Classroom can be assigned as Homework: it starts from zero and closes the Classroom work.</>
              : <>Open a skill and pick sets by source and level. Sets {first} already has in Classroom or as Homework are grayed out: once a set is Homework, Classroom is closed for it. A level is marked when every source is.</>}
          </p>
          <SkillsSourceMap
            emptyText={
              filtering
                ? "No practice set matches the filters."
                : `No ${practiceAreaLabel(areaCode)} practice set to assign: ${first} already has every published set of their program, or there is none yet.`
            }
            emptySourcesText="No set to assign."
            domains={domains.map((domain) => ({
              id: domain.id,
              name: domain.name,
              skills: domain.skills.map((skill): SkillsSourceSkill => {
                const toAssign = skill.sets.filter((ps) => !isAssigned(ps));
                const assignedCount = skill.sets.length - toAssign.length;
                const picked = toAssign.filter((ps) => selected.has(ps.id)).length;
                const sources = [...new Map(skill.sets.map((ps) => [ps.sourceId, { id: ps.sourceId, name: ps.sourceName, order: ps.sourceOrder }])).values()].sort(
                  (a, b) => a.order - b.order || a.name.localeCompare(b.name),
                );
                return {
                  id: skill.id,
                  name: skill.name,
                  sub: `${toAssign.length} set${toAssign.length === 1 ? "" : "s"} to assign${assignedCount ? ` · ${assignedCount} already assigned` : ""}${picked ? ` · ${picked} selected` : ""}`,
                  open: Boolean(skillFilter) || picked > 0 || skill.id === openSkillId ? true : undefined,
                  chips: DIFFICULTIES.map((level): SkillsMapChip => {
                    const count = toAssign.filter((ps) => ps.difficulty === level).length;
                    const assignedAtLevel = skill.sets.filter((ps) => ps.difficulty === level && isAssigned(ps)).length;
                    if (count) {
                      return { difficulty: level, state: "available", title: `${count} set${count === 1 ? "" : "s"} to assign`, extra: <span className="text-[var(--sat-muted)]">{count} set{count === 1 ? "" : "s"}</span> };
                    }
                    // Every source's set at this level is already assigned: stamp the level (not "—").
                    const homeworkAtLevel = skill.sets.filter((ps) => ps.difficulty === level && inHomeworkOnly(ps)).length;
                    return assignedAtLevel
                      ? { difficulty: level, state: "available", assigned: true, stamp: true, assignedLabel: homeworkAtLevel === assignedAtLevel ? "In Homework" : undefined, title: `${assignedAtLevel} set${assignedAtLevel === 1 ? "" : "s"}`, extra: <span className="text-[var(--sat-muted)]">{assignedAtLevel} set{assignedAtLevel === 1 ? "" : "s"}</span> }
                      : { difficulty: level, state: "none", title: "Nothing to assign at this level" };
                  }),
                  // Every source and level already assigned: a fixed row with the stamped levels (no rows
                  // to open, nothing to pick).
                  rows: toAssign.length === 0 ? undefined : sources.map((source) => {
                    const sets = skill.sets.filter((ps) => ps.sourceId === source.id);
                    return {
                      id: source.id,
                      name: source.name,
                      chips: DIFFICULTIES.flatMap((level) => {
                        const ofLevel = sets.filter((ps) => ps.difficulty === level);
                        return ofLevel.map((ps): SkillsMapChip => ({
                          difficulty: level,
                          state: "available",
                          label: ofLevel.length > 1 ? setNumber(ps.name) : undefined,
                          title: `${ps.name} · ${ps.questionCount} questions`,
                          extra: <span className="text-[var(--sat-muted)]">{ps.questionCount} Q</span>,
                          ...(isAssigned(ps) ? { assigned: true, assignedLabel: inHomeworkOnly(ps) ? "In Homework" : undefined } : { selected: selected.has(ps.id), onClick: () => toggleSelect(ps.id) }),
                        }));
                      }),
                    };
                  }),
                };
              }),
            }))}
          />
          <p className="text-xs text-gray-400">{selected.size} selected</p>
          </>
          )}
        </div>
        </AssignStep>
        </>
      )}

      <InlineError>{error}</InlineError>
      </div>

      <aside className="lg:sticky lg:top-6">
        <AssignStep n={editMode ? 3 : 5} title={editMode ? "Change the dates and save" : "Set the dates and assign"}>
        <AssignSummaryCard
          to={target === "group" ? groups.find((g) => g.id === groupId)?.name ?? "Group" : studentName}
          countLabel="Practice sets"
          items={[
            ...practiceSets.filter((ps) => !isAssigned(ps) && selected.has(ps.id)).map((ps) => `${ps.topicName} · ${difficultyLabel(ps.difficulty)} · ${ps.sourceName}`),
            ...editing.map((set) => set.name),
          ]}
          options={options}
          onOptionsChange={setOptions}
          // The tab chosen above the sets (read-only here).
          context={{ value: context, note: editMode ? "Fixed once assigned." : target === "group" ? "Group assignments are Homework." : undefined }}
          dueHint="Due at the end of that day. Starts one week from today; change it if needed."
          extra={
            // Admin › Settings "Keep it locked" option (off by default: hidden).
            lockOptionEnabled ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={lockOnAssign} onChange={(e) => setLockOnAssign(e.target.checked)} />
                Keep it locked for now (you unlock it later)
              </label>
            ) : null
          }
          submitLabel={editMode ? (loading ? "Saving..." : "Save changes") : loading ? "Assigning..." : `Assign ${selected.size > 0 ? `(${selected.size})` : ""}`}
          onSubmit={handleAssign}
          loading={loading}
          disabledReason={!context ? "Choose Classroom or Homework." : selected.size === 0 ? "Select at least one practice set." : null}
          onCancel={() => router.back()}
        />
        </AssignStep>
      </aside>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? "Saved" : "Assigned"}</DialogTitle>
            <DialogDescription>{successMessage || "Assigned"}. {target === "group" ? "The group's students" : first} will see it on their Home and Practice pages.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {editMode ? null : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(new Set());
                  setSuccess(false);
                }}
              >
                Assign more
              </Button>
            )}
            <Button onClick={() => router.push(backHref)}>Back to {first}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** "… - HARD - #2" → "#2" (several sets of one skill, level and source). */
function setNumber(name: string) {
  return name.match(/#\d+\s*$/)?.[0].trim() ?? name;
}
