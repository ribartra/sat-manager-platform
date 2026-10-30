"use client";

import Link from "next/link";
import { Hint } from "@/components/hint";
import { neighbourViews, useNavViews } from "@/components/nav-views";

const LINK = "font-medium text-[var(--sat-primary)] hover:underline";

/**
 * "← Students · Tests →" at the right of the breadcrumb row of a main view: the previous and next
 * views in menu order (the same as the `[` / `]` keys). Only on a view's own page, not its sub-pages.
 */
export function ViewStepper() {
  const { views, current, isRoot } = useNavViews();
  if (!isRoot) return null;
  const { previous, next } = neighbourViews(views, current);
  if (!previous || !next) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 text-[13px]">
      <Hint label="Previous view (shortcut: [ )">
        <Link href={previous.href} className={LINK}>← {previous.label}</Link>
      </Hint>
      <span aria-hidden className="text-[var(--sat-blank)]">·</span>
      <Hint label="Next view (shortcut: ] )">
        <Link href={next.href} className={LINK}>{next.label} →</Link>
      </Hint>
    </span>
  );
}
