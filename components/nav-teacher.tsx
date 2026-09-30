"use client";

import { BLOCKED_TEXT } from "@/components/ui/control-states";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, KeyRound, LogOut, Camera, Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar } from "@/components/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FeatureSettingKey } from "@/lib/app-settings";
import {
  groupIsActive,
  hrefWithArea,
  isPlayerPath,
  isResolvedNavGroup,
  linkIsActive,
  resolveTeacherNav,
  type ResolvedNavEntry,
} from "@/lib/nav-config";

interface NavTeacherProps {
  userName: string;
  avatarUrl?: string | null;
  role?: string;
  /** Platform feature flags (UI visibility only — not authorization). */
  flags?: Partial<Record<FeatureSettingKey, boolean>>;
  /** @deprecated Prefer `flags.TEACHER_PROGRAM_MANAGEMENT` */
  showTeacherPrograms?: boolean;
  /** @deprecated Prefer `flags.TEACHER_GROUP_MANAGEMENT` */
  showTeacherGroups?: boolean;
  /** @deprecated Prefer `flags.MATERIALS_MODULE` */
  showMaterials?: boolean;
}

function initExpanded(items: ResolvedNavEntry[], pathname: string): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const item of items) {
    if (isResolvedNavGroup(item)) {
      state[item.label] = groupIsActive(item, pathname);
    }
  }
  return state;
}

export function NavTeacher({
  userName,
  avatarUrl: initialAvatarUrl,
  role,
  flags,
  showTeacherPrograms,
  showTeacherGroups,
  showMaterials,
}: NavTeacherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedArea = searchParams.get("area");
  const resolvedFlags: Partial<Record<FeatureSettingKey, boolean>> = {
    TEACHER_PROGRAM_MANAGEMENT: flags?.TEACHER_PROGRAM_MANAGEMENT ?? showTeacherPrograms ?? false,
    TEACHER_GROUP_MANAGEMENT: flags?.TEACHER_GROUP_MANAGEMENT ?? showTeacherGroups ?? false,
    MATERIALS_MODULE: flags?.MATERIALS_MODULE ?? showMaterials ?? false,
  };
  const navItems = resolveTeacherNav({ role, flags: resolvedFlags });

  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    initExpanded(navItems, pathname),
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isPlayerPath(pathname)) return null;

  function onGroupEnter(label: string) {
    clearTimeout(closeTimer.current);
    setOpenGroup(label);
  }

  function onGroupLeave() {
    closeTimer.current = setTimeout(() => setOpenGroup(null), 120);
  }

  function onContentEnter() {
    clearTimeout(closeTimer.current);
  }

  function toggleExpanded(label: string) {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function closeMobile() {
    setMobileOpen(false);
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

  return (
    <TooltipProvider delayDuration={500}>
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[var(--sat-page-wide)] px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-5">
              <span className="font-semibold text-gray-800 text-sm shrink-0">SAT Platform</span>

              <div className="hidden lg:flex items-center gap-0.5">
                {navItems.map((item) => {
                  if (!isResolvedNavGroup(item)) {
                    const active = linkIsActive(item.href, pathname);
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Link
                            href={hrefWithArea(item.href, selectedArea)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                              active ? "text-gray-900" : "text-gray-400 hover:text-gray-700",
                            )}
                          >
                            <item.icon size={14} />
                            {item.label}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  }

                  const active = groupIsActive(item, pathname);
                  const isOpen = openGroup === item.label;

                  return (
                    <div
                      key={item.label}
                      className="relative"
                      onMouseEnter={() => onGroupEnter(item.label)}
                      onMouseLeave={onGroupLeave}
                    >
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors outline-none",
                          active ? "text-gray-900" : "text-gray-400 hover:text-gray-700",
                        )}
                      >
                        <item.icon size={14} />
                        {item.label}
                        <ChevronDown
                          size={11}
                          className={cn("ml-0.5 transition-transform", isOpen && "rotate-180")}
                        />
                      </button>

                      {isOpen && (
                        <div
                          role="menu"
                          className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md"
                          onMouseEnter={onContentEnter}
                          onMouseLeave={onGroupLeave}
                        >
                          {item.links.map((link) => {
                            const linkActive = linkIsActive(link.href, pathname, link.exact);
                            return (
                              <Link
                                key={link.href}
                                href={hrefWithArea(link.href, selectedArea)}
                                role="menuitem"
                                onClick={() => setOpenGroup(null)}
                                className={cn(
                                  "flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100",
                                  linkActive ? "text-gray-900 font-medium" : "text-gray-500",
                                )}
                              >
                                <link.icon
                                  size={14}
                                  className={linkActive ? "text-gray-700" : "text-gray-400"}
                                />
                                {link.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <Avatar name={userName} avatarUrl={avatarUrl} size="sm" />
                  <span className="hidden sm:inline">{userName}</span>
                  <ChevronDown size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-52 rounded-md border border-gray-200 bg-white shadow-lg z-10">
                    <button
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
                    <button
                      onClick={() => {
                        window.location.href = "/auth/change-password";
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <KeyRound size={14} />
                      Change password
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={closeMobile} />
      )}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm">SAT Platform</span>
          <button onClick={closeMobile} className="p-1.5 rounded-md text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            if (!isResolvedNavGroup(item)) {
              const active = linkIsActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={hrefWithArea(item.href, selectedArea)}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-gray-900" : "text-gray-500 hover:text-gray-800",
                  )}
                >
                  <item.icon size={16} className={active ? "text-gray-700" : "text-gray-400"} />
                  {item.label}
                </Link>
              );
            }

            const active = groupIsActive(item, pathname);
            const expanded = expandedGroups[item.label] ?? false;

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleExpanded(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-gray-900" : "text-gray-500 hover:text-gray-800",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon size={16} className={active ? "text-gray-700" : "text-gray-400"} />
                    {item.label}
                  </span>
                  <ChevronRight
                    size={14}
                    className={cn("text-gray-400 transition-transform", expanded && "rotate-90")}
                  />
                </button>
                {expanded && (
                  <div className="pl-9 pb-1">
                    {item.links.map((link) => {
                      const linkActive = linkIsActive(link.href, pathname, link.exact);
                      return (
                        <Link
                          key={link.href}
                      href={hrefWithArea(link.href, selectedArea)}
                          onClick={closeMobile}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                            linkActive ? "text-gray-900 font-medium" : "text-gray-500 hover:text-gray-800",
                          )}
                        >
                          <link.icon size={14} className={linkActive ? "text-gray-700" : "text-gray-400"} />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
            <Avatar name={userName} avatarUrl={avatarUrl} size="sm" />
            <span className="text-sm font-medium text-gray-700 truncate">{userName}</span>
          </div>
          <button
            onClick={() => {
              closeMobile();
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className={`flex w-full items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-50 ${BLOCKED_TEXT}`}
          >
            <Camera size={14} />
            {uploading ? "Uploading..." : "Change photo"}
          </button>
          <button
            onClick={() => {
              window.location.href = "/auth/change-password";
            }}
            className="flex w-full items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-50"
          >
            <KeyRound size={14} />
            Change password
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-50"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarChange}
      />
    </TooltipProvider>
  );
}
