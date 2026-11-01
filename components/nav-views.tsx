"use client";

import { createContext, useContext } from "react";

/** One main view of the sidebar (Home, Students, Tests…), in menu order. */
export interface NavView {
  href: string;
  label: string;
}

/**
 * The main views of the current portal (the sidebar's direct links, in order, without the Admin
 * group) and which one is open. AppShell provides it; the breadcrumb row's previous / next links and
 * the keyboard shortcuts read it. Outside AppShell (auth, parent pages) it is empty.
 */
export const NavViewsContext = createContext<{ views: NavView[]; current: number; isRoot: boolean }>({ views: [], current: -1, isRoot: false });

export function useNavViews() {
  return useContext(NavViewsContext);
}

/** The view before / after the current one (the menu order wraps around). */
export function neighbourViews(views: NavView[], current: number) {
  if (current < 0 || views.length < 2) return { previous: null, next: null };
  return { previous: views[(current - 1 + views.length) % views.length], next: views[(current + 1) % views.length] };
}

/** The sidebar's Shortcuts help (useViewShortcuts). */
export function viewShortcutsLabel() {
  return "Shift+↑ / Shift+↓ go to the previous / next view (menu order)";
}
