"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronLeft, ChevronRight, Keyboard, KeyRound, LogOut, Menu, X } from "lucide-react";
import { Hint } from "@/components/hint";
import { NavViewsContext, viewShortcutsLabel } from "@/components/nav-views";
import { useViewShortcuts } from "@/hooks/use-view-shortcuts";
import { Avatar } from "@/components/avatar";
import { IssueReportButton } from "@/components/sat/issue-reporter";
import { NotificationBell, sidePopoverPosition } from "@/components/notification-bell";
import { BLOCKED_TEXT } from "@/components/ui/control-states";
import {
  groupIsActive,
  hrefWithArea,
  isPlayerPath,
  isResolvedNavGroup,
  linkIsActive,
  navPathname,
  type ResolvedNavEntry,
  type ResolvedNavLink,
} from "@/lib/nav-config";
import { cn } from "@/lib/utils";

/**
 * App chrome from the mockup (`mejorada`): a persistent left sidebar (228px; 68px when collapsed)
 * with icon + label links, Notifications and the user button at the bottom, and an off-canvas
 * drawer under 860px. Players (full screen) render without it.
 */
export interface AppShellProps {
  brand: "SAT Practice" | "SAT Platform";
  /** Small caption under the logo (teacher: "TEACHER"). */
  caption?: string;
  roleLabel: string;
  userName: string;
  avatarUrl?: string | null;
  items: ResolvedNavEntry[];
  /** Extra links in the user menu (e.g. Programs). */
  userMenuLinks?: ResolvedNavLink[];
  /** Student sidebar can be collapsed to icons (remembered in this browser). */
  collapsible?: boolean;
  /** Banners shown above the page (impersonation, enrollment). */
  banner?: React.ReactNode;
  mainClassName?: string;
  children: React.ReactNode;
}

const COLLAPSE_KEY = "sat.sidebar.collapsed";

export function AppShell({
  brand,
  caption,
  roleLabel,
  userName,
  avatarUrl: initialAvatarUrl,
  items,
  userMenuLinks = [],
  collapsible = false,
  banner,
  mainClassName,
  children,
}: AppShellProps) {
  const searchParams = useSearchParams();
  const selectedArea = searchParams.get("area");
  // The path the sidebar highlights for (Question Bank › Tests belongs to Tests).
  const pathname = navPathname(usePathname(), selectedArea);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<React.CSSProperties>({});
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter(isResolvedNavGroup).map((g) => [g.label, groupIsActive(g, pathname)])),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!collapsible) return;
    try {
      // Per-viewer convenience only: the layout works the same without it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [collapsible]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // The main views (direct sidebar links, in order) for the previous / next links and the keys.
  const directViews = items.flatMap((item) => (isResolvedNavGroup(item) ? [] : [{ href: item.href, label: item.label, exact: item.exact }]));
  const currentView = directViews.findIndex((view) => linkIsActive(view.href, pathname, view.exact));
  const navViews = {
    views: directViews.map(({ href, label }) => ({ href, label })),
    current: currentView,
    isRoot: currentView >= 0 && pathname === directViews[currentView].href,
  };
  const inPlayer = isPlayerPath(pathname, searchParams);
  useViewShortcuts(navViews.views, navViews.current, !inPlayer);

  if (inPlayer) return <>{children}</>;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
    const data = await res.json();
    if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const mini = collapsible && collapsed;
  const label = mini ? "min-[860px]:hidden" : "";
  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 whitespace-nowrap rounded-[9px] px-3 py-2.5 text-[15px] font-medium",
      active ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-700 hover:bg-slate-100",
      mini && "min-[860px]:justify-center min-[860px]:px-0",
    );

  return (
    <div className="min-h-screen">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-2.5 top-2 z-[36] grid h-[38px] w-[38px] place-items-center rounded-lg border border-gray-200 bg-white text-gray-700 min-[860px]:hidden"
      >
        <Menu size={18} />
      </button>
      {mobileOpen ? (
        <button type="button" aria-label="Close menu" className="fixed inset-0 z-[34] bg-black/30 min-[860px]:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <nav
        aria-label="Main"
        className={cn(
          "fixed inset-y-0 left-0 z-[35] flex flex-col border-r border-gray-200 bg-white px-3 py-4 transition-[width,transform] duration-150",
          "w-60 max-[859px]:shadow-xl",
          mobileOpen ? "translate-x-0" : "max-[859px]:-translate-x-full",
          mini ? "min-[860px]:w-[68px]" : "min-[860px]:w-[228px]",
        )}
      >
        <div className="flex items-center justify-between">
          <Link href={items[0] && !isResolvedNavGroup(items[0]) ? items[0].href : "/"} className="flex items-center gap-2 px-2 pb-[18px] pt-0.5 text-base font-extrabold text-slate-900">
            <i className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-[11px] not-italic text-white">SAT</i>
            <span className={label}>{brand}</span>
          </Link>
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="mb-4 rounded-md p-1 text-gray-500 min-[860px]:hidden">
            <X size={18} />
          </button>
        </div>
        {caption ? <p className={cn("px-3 pb-2.5 text-xs font-bold tracking-wide text-slate-500", label)}>{caption}</p> : null}

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => {
            if (!isResolvedNavGroup(item)) {
              const active = linkIsActive(item.href, pathname, item.exact);
              return (
                <Link key={item.href} href={hrefWithArea(item.href, selectedArea)} title={item.label} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                  <item.icon size={19} className="shrink-0" />
                  <span className={label}>{item.label}</span>
                </Link>
              );
            }
            const open = openGroups[item.label] ?? false;
            const active = groupIsActive(item, pathname);
            return (
              <div key={item.label}>
                <button
                  type="button"
                  title={item.label}
                  aria-expanded={open}
                  onClick={() => setOpenGroups((g) => ({ ...g, [item.label]: !open }))}
                  className={cn(linkClass(active && !open), "w-full")}
                >
                  <item.icon size={19} className="shrink-0" />
                  <span className={cn("flex-1 text-left", label)}>{item.label}</span>
                  <ChevronRight size={14} className={cn("shrink-0 text-gray-400 transition-transform", open && "rotate-90", label)} />
                </button>
                {open ? (
                  <div className={cn("ml-4 flex flex-col gap-0.5 border-l border-gray-100 pl-2", mini && "min-[860px]:ml-0 min-[860px]:border-0 min-[860px]:pl-0")}>
                    {item.links.map((link) => {
                      const linkActive = linkIsActive(link.href, pathname, link.exact);
                      return (
                        <Link key={link.href} href={link.href} title={link.label} aria-current={linkActive ? "page" : undefined} className={cn(linkClass(linkActive), "py-2 text-sm")}>
                          <link.icon size={16} className="shrink-0" />
                          <span className={label}>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          {collapsible ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              title={mini ? "Expand menu" : "Collapse menu"}
              aria-label={mini ? "Expand menu" : "Collapse menu"}
              className={cn("mt-1.5 hidden items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-500 hover:bg-slate-100 min-[860px]:flex", mini && "justify-center px-0")}
            >
              {mini ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              <span className={label}>Collapse</span>
            </button>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-1 border-t border-gray-200 pt-2.5">
          {navViews.views.length > 1 ? (
            // The keyboard shortcuts between views (useViewShortcuts), always discoverable here.
            <Hint label={viewShortcutsLabel(navViews.views.length)} side="right">
              <button
                type="button"
                aria-label={`Keyboard shortcuts: ${viewShortcutsLabel(navViews.views.length)}`}
                className={cn("flex items-center gap-3 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13px] text-slate-500 hover:bg-slate-100", mini && "min-[860px]:justify-center min-[860px]:px-0")}
              >
                <Keyboard size={16} aria-hidden />
                <span className={label}>Shortcuts</span>
              </button>
            </Hint>
          ) : null}
          <IssueReportButton collapsed={mini} onStart={() => setMobileOpen(false)} />
          <NotificationBell collapsed={mini} />
          <div ref={userRef}>
            <button
              ref={userButtonRef}
              type="button"
              title={userName}
              aria-label={`Account menu for ${userName}`}
              aria-expanded={menuOpen}
              onClick={() => {
                if (!menuOpen && userButtonRef.current) setMenuPos(sidePopoverPosition(userButtonRef.current));
                setMenuOpen((v) => !v);
              }}
              className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 py-2 text-left hover:bg-slate-100"
            >
              <Avatar name={userName} avatarUrl={avatarUrl} size="sm" />
              <span className={cn("min-w-0 leading-tight", label)}>
                <b className="block truncate text-sm text-slate-900">{userName}</b>
                <span className="text-xs text-slate-500">{roleLabel}</span>
              </span>
              <ChevronDown size={14} className={cn("ml-auto shrink-0 text-gray-400", label)} />
            </button>
            {menuOpen ? (
              <div style={menuPos} className="fixed z-50 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl max-[859px]:!left-3 max-[859px]:!right-3 max-[859px]:!w-auto">
                {userMenuLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                    <link.icon size={14} />
                    {link.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 ${BLOCKED_TEXT}`}
                >
                  <Camera size={14} />
                  {uploading ? "Uploading..." : "Change photo"}
                </button>
                <Link href="/auth/change-password" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  <KeyRound size={14} />
                  Change password
                </Link>
                <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <div
        className={cn(
          "flex min-h-screen flex-col max-[859px]:pt-[52px] transition-[padding] duration-150",
          mini ? "min-[860px]:pl-[68px]" : "min-[860px]:pl-[228px]",
        )}
      >
        {banner}
        <main className={cn("flex min-h-0 flex-1 flex-col", mainClassName)}>
          <NavViewsContext.Provider value={navViews}>{children}</NavViewsContext.Provider>
        </main>
      </div>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
    </div>
  );
}
