"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Home, Map, ClipboardList, Clock, ChevronDown, KeyRound, LogOut,
  BookOpen, FolderOpen, Camera, Menu, X,
} from "lucide-react";
import { useRef, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar } from "@/components/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavStudentProps {
  userName: string;
  avatarUrl?: string | null;
  isImpersonated?: boolean;
  hasActiveEnrollment?: boolean;
  onExitImpersonation?: () => void;
}

const fullLinks = [
  { href: "/student", label: "Home", icon: Home, exact: true },
  { href: "/student/practice-sets", label: "Practice Sets", icon: BookOpen },
  { href: "/student/content-map", label: "Content Map", icon: Map },
  { href: "/student/materials", label: "Materials", icon: BookOpen },
  { href: "/student/full-tests", label: "Exams", icon: ClipboardList },
  { href: "/student/history", label: "History", icon: Clock },
];

const restrictedLinks = [
  { href: "/student/program", label: "Programs", icon: FolderOpen, exact: false },
];

export function NavStudent({
  userName,
  avatarUrl: initialAvatarUrl,
  isImpersonated,
  hasActiveEnrollment = true,
  onExitImpersonation,
}: NavStudentProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const links = hasActiveEnrollment ? fullLinks : restrictedLinks;

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
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
    <>
      {isImpersonated && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-amber-800 font-medium">
            ⚠ You are viewing as: <strong>{userName}</strong>
          </span>
          <button
            onClick={onExitImpersonation}
            className="text-sm text-amber-700 underline hover:text-amber-900"
          >
            Exit Student View →
          </button>
        </div>
      )}

      {!hasActiveEnrollment && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-center">
          <p className="text-xs text-blue-700">
            You are not enrolled in an active program yet. Request enrollment to access the full platform.
          </p>
        </div>
      )}

      <TooltipProvider delayDuration={500}>
        {/* ── Desktop nav ──────────────────────────────────────────────── */}
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex h-14 items-center justify-between">

              {/* Left: brand + desktop links */}
              <div className="flex items-center gap-5">
                <span className="font-semibold text-gray-800 text-sm">SAT Practice</span>

                {/* Desktop links — hidden below md */}
                <div className="hidden md:flex items-center gap-0.5">
                  {links.map(({ href, label, icon: Icon, exact }) => (
                    <Tooltip key={href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={href}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            isActive(href, exact)
                              ? "text-gray-900"
                              : "text-gray-400 hover:text-gray-700"
                          )}
                        >
                          <Icon size={14} />
                          {label}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Right: bell + user menu + hamburger */}
              <div className="flex items-center gap-1">
                <NotificationBell />

                {/* User menu */}
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
                        onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
                        disabled={uploading}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Camera size={14} />
                        {uploading ? "Uploading..." : "Change photo"}
                      </button>
                      <button
                        onClick={() => { window.location.href = "/auth/change-password"; }}
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

                {/* Hamburger — visible below md */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
                  aria-label="Open menu"
                >
                  <Menu size={20} />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* ── Mobile drawer ─────────────────────────────────────────────── */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={closeMobile}
          />
        )}
        <div
          className={cn(
            "fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 ease-in-out md:hidden",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">SAT Practice</span>
            <button
              onClick={closeMobile}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer links */}
          <div className="flex-1 overflow-y-auto py-2">
            {links.map(({ href, label, icon: Icon, exact }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive(href, exact)
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                )}
              >
                <Icon size={16} className={isActive(href, exact) ? "text-gray-700" : "text-gray-400"} />
                {label}
              </Link>
            ))}
          </div>

          {/* Drawer footer */}
          <div className="border-t border-gray-100 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
              <Avatar name={userName} avatarUrl={avatarUrl} size="sm" />
              <span className="text-sm font-medium text-gray-700 truncate">{userName}</span>
            </div>
            <button
              onClick={() => { closeMobile(); fileInputRef.current?.click(); }}
              disabled={uploading}
              className="flex w-full items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <Camera size={14} />
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            <button
              onClick={() => { window.location.href = "/auth/change-password"; }}
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
    </>
  );
}
