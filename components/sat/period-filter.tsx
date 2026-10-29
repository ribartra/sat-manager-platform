"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterField } from "@/components/sat/filter-bar";
import { isoDay, periodLabel, PERIODS, type Period, type PeriodValue } from "@/lib/period-filter";

/**
 * The date filter of every FilterBar: a "Period" select (All time, Last week, Last month, Last year,
 * Custom…). Custom opens a dialog to pick the start and end dates ("Change dates…" reopens it);
 * applying it submits the bar's form.
 * Sends `period` (+ `from` / `to` for Custom) — pages read them with resolvePeriod.
 */
export function PeriodFilter({ value, label = "Period" }: { value: PeriodValue; label?: string }) {
  const [period, setPeriod] = useState<Period>(value.period);
  const [range, setRange] = useState({ from: value.from ?? "", to: value.to ?? "" });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const anchor = useRef<HTMLInputElement>(null);
  const today = isoDay(new Date());
  const invalid = draft.from && draft.to && draft.from > draft.to ? "The end date is before the start date." : !draft.from && !draft.to ? "Choose at least one date." : null;

  function openCustom() {
    setDraft(range.from || range.to ? range : { from: "", to: today });
    setOpen(true);
  }

  function quick(days: number | "year") {
    const start = new Date();
    if (days === "year") start.setMonth(0, 1);
    else start.setDate(start.getDate() - days);
    setDraft({ from: isoDay(start), to: today });
  }

  function applyCustom() {
    if (invalid) return;
    flushSync(() => {
      setRange(draft);
      setPeriod("custom");
      setOpen(false);
    });
    anchor.current?.form?.requestSubmit();
  }

  const custom = period === "custom";
  return (
    <FilterField label={label} htmlFor="pf-period" className="@md:min-w-[11.5rem]">
        <Select
          id="pf-period"
          name="period"
          value={period}
          onChange={(e) => {
            const next = e.target.value;
            // "Custom…" and, once a custom range is set, "Change dates…" open the dialog.
            if (next === "custom" || next === "edit") openCustom();
            else setPeriod(next as Period);
          }}
          title={custom ? periodLabel({ period: "custom", from: range.from || undefined, to: range.to || undefined }) : undefined}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value === "custom" && custom ? periodLabel({ period: "custom", from: range.from || undefined, to: range.to || undefined }, true) : p.label}
            </option>
          ))}
          {custom ? <option value="edit">Change dates…</option> : null}
        </Select>
      {/* Custom dates travel with the form; the other periods are resolved on the server. */}
      <input ref={anchor} type="hidden" name="from" value={custom ? range.from : ""} disabled={!custom || !range.from} />
      <input type="hidden" name="to" value={custom ? range.to : ""} disabled={!custom || !range.to} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Custom period</DialogTitle>
            <DialogDescription>Choose the first and the last day to include.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => quick(30)}>Last 30 days</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => quick(90)}>Last 3 months</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => quick("year")}>This year</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">
              Start date
              <Input type="date" value={draft.from} max={draft.to || today} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">
              End date
              <Input type="date" value={draft.to} min={draft.from || undefined} max={today} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </label>
          </div>
          {invalid && (draft.from || draft.to) ? <p className="text-xs text-[var(--sat-bad)]">{invalid}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={applyCustom} disabled={Boolean(invalid)} disabledReason={invalid}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FilterField>
  );
}
