"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type StudentOption = {
  id: string;
  name: string;
  email?: string | null;
};

type StudentPickerBase = {
  students: StudentOption[];
  excludeIds?: string[];
  filterBy?: "name" | "nameEmail";
  placeholder?: string;
  label?: string;
  className?: string;
  /** Controlled search; if omitted, search is internal. */
  search?: string;
  onSearchChange?: (query: string) => void;
  showSearch?: boolean;
  emptyLabel?: string;
};

type SingleProps = StudentPickerBase & {
  mode: "single";
  value: string;
  onChange: (next: string) => void;
  /** Hidden input name for native forms (optional). */
  name?: string;
};

type MultiProps = StudentPickerBase & {
  mode: "multi";
  value: string[];
  onChange: (next: string[]) => void;
};

type AddProps = StudentPickerBase & {
  mode: "add";
  onAdd: (studentId: string) => void;
  maxVisible?: number;
};

export type StudentPickerProps = SingleProps | MultiProps | AddProps;

function useFilteredStudents(
  students: StudentOption[],
  query: string,
  filterBy: "name" | "nameEmail",
  excludeIds?: string[],
) {
  return useMemo(() => {
    const excluded = new Set(excludeIds ?? []);
    const term = query.trim().toLowerCase();
    return students.filter((student) => {
      if (excluded.has(student.id)) return false;
      if (!term) return true;
      if (filterBy === "nameEmail") {
        return (
          student.name.toLowerCase().includes(term) ||
          (student.email ?? "").toLowerCase().includes(term)
        );
      }
      return student.name.toLowerCase().includes(term);
    });
  }, [excludeIds, filterBy, query, students]);
}

function SingleStudentCombobox({
  students,
  excludeIds,
  filterBy = "name",
  placeholder = "Search student...",
  label,
  className,
  emptyLabel = "No students match the current search.",
  value,
  onChange,
  name,
  search: controlledSearch,
  onSearchChange,
}: SingleProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalSearch, setInternalSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [focused, setFocused] = useState(false);

  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  const selected = students.find((student) => student.id === value);
  const filtered = useFilteredStudents(students, search, filterBy, excludeIds);
  const options =
    selected && !filtered.some((student) => student.id === selected.id)
      ? [selected, ...filtered]
      : filtered;

  const inputValue = focused || search.trim() ? search : selected?.name.trim() || "";

  useEffect(() => {
    setHighlight(0);
  }, [search]);

  function choose(id: string) {
    onChange(id);
    const chosen = students.find((student) => student.id === id);
    setSearch(chosen?.name.trim() ?? "");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setSearch(selected?.name.trim() ?? "");
      return;
    }
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[highlight];
      if (option) choose(option.id);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-xs font-medium text-gray-500">{label}</p> : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <div className="relative">
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label ?? "Select student"}
          value={inputValue}
          placeholder={placeholder}
          className="text-sm"
          onFocus={() => {
            setFocused(true);
            setOpen(true);
            setSearch("");
          }}
          onBlur={() => {
            setFocused(false);
            window.setTimeout(() => {
              setOpen(false);
              setSearch("");
            }, 150);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-sm"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">
                {students.length === 0 ? "No students available" : emptyLabel}
              </li>
            ) : (
              options.map((student, index) => {
                const isSelected = student.id === value;
                const isActive = index === highlight;
                return (
                  <li key={student.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-sm",
                        isActive && "bg-gray-50",
                        isSelected && "font-medium text-blue-700",
                        !isSelected && "text-gray-800 hover:bg-gray-50",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(student.id)}
                    >
                      {student.name.trim() || "Unnamed student"}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Unified student search + selection for teacher flows.
 * Modes: single (combobox), multi (checkboxes), add (click-to-add chips).
 */
export function StudentPicker(props: StudentPickerProps) {
  const {
    students,
    excludeIds,
    filterBy = "name",
    placeholder = "Search student...",
    label,
    className,
    showSearch = true,
    emptyLabel = "No students match the current search.",
  } = props;

  const [internalSearch, setInternalSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const search = props.search ?? internalSearch;
  const setSearch = props.onSearchChange ?? setInternalSearch;

  const filtered = useFilteredStudents(students, search, filterBy, excludeIds);

  if (props.mode === "single") {
    return <SingleStudentCombobox {...props} />;
  }

  const searchField = showSearch ? (
    <Input
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder={placeholder}
      className="text-sm"
    />
  ) : null;

  if (props.mode === "multi") {
    const selected = new Set(props.value);
    return (
      <div className={cn("rounded-md border border-gray-200 p-3", className)}>
        {label ? <p className="mb-2 text-xs font-medium text-gray-500">{label}</p> : null}
        {searchField ? <div className="mb-3">{searchField}</div> : null}
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {filtered.map((student) => (
            <label key={student.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.has(student.id)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(student.id);
                  else next.delete(student.id);
                  props.onChange([...next]);
                }}
              />
              {student.name}
            </label>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400">{emptyLabel}</p>}
        </div>
      </div>
    );
  }

  const maxVisible = props.maxVisible ?? 5;
  const visible = showAll ? filtered : filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - maxVisible;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-xs font-medium text-gray-500">{label}</p> : null}
      {searchField}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => props.onAdd(student.id)}
              className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <UserPlus size={10} /> {student.name}
            </button>
          ))}
          {!showAll && hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              View all ({hiddenCount} more)
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
