"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 8;

/**
 * Search of an entity list (students, teachers, users, programs…): every keystroke filters the list
 * (the URL's `name` param is replaced, the page re-renders, other filters kept, back to page 1), and
 * the matching values show under the box; picking one applies it at once. Without `name` it works on
 * local state (lists filtered in the browser) through `value` / `onChange`.
 */
export function LiveSearch({
  id,
  name,
  defaultValue = "",
  value,
  onChange,
  placeholder = "Search",
  suggestions = [],
  pageParam = "page",
  className,
}: {
  id?: string;
  /** URL param to update (server-filtered lists). */
  name?: string;
  defaultValue?: string;
  /** Controlled mode (client-filtered lists). */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Values of the list (names, emails…) offered while typing. */
  suggestions?: string[];
  /** Page param reset when the search changes. */
  pageParam?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [own, setOwn] = useState(defaultValue);
  const text = value ?? own;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const needle = text.trim().toLowerCase();
  const matches = needle
    ? [...new Set(suggestions)].filter((s) => s.toLowerCase().includes(needle) && s.toLowerCase() !== needle).slice(0, MAX_SUGGESTIONS)
    : [];

  function push(next: string) {
    if (!name) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set(name, next.trim());
    else params.delete(name);
    params.delete(pageParam);
    const qs = params.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  function change(next: string, immediate = false) {
    if (value === undefined) setOwn(next);
    onChange?.(next);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) push(next);
    else timer.current = setTimeout(() => push(next), DEBOUNCE_MS);
  }

  function pick(next: string) {
    change(next, true);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className={cn("relative", className)}>
      {pending ? (
        <Loader2 size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
      ) : (
        <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      )}
      <Input
        id={id}
        name={name}
        type="search"
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        placeholder={placeholder}
        className="pl-8"
        onChange={(e) => {
          change(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && matches.length) {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp" && matches.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
          } else if (e.key === "Enter") {
            // Enter picks the highlighted value, or applies what was typed (no full form submit).
            e.preventDefault();
            if (active >= 0 && matches[active]) pick(matches[active]);
            else change(text, true);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 ? (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-md">
          {matches.map((match, index) => (
            <li
              key={match}
              role="option"
              aria-selected={index === active}
              // mousedown: pick before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(match);
              }}
              className={cn("cursor-pointer truncate rounded-sm px-2 py-1.5 text-sm text-gray-800", index === active ? "bg-gray-100" : "hover:bg-gray-50")}
            >
              {match}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
