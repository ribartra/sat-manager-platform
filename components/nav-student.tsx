"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Home, Map, ClipboardList, ChevronDown, KeyRound, LogOut, Bell, BookOpen } from "lucide-react";
import { useState } from "react";

interface NavStudentProps {
  userName: string;
  isImpersonated?: boolean;
  onExitImpersonation?: () => void;
}

const links = [
  { href: "/student", label: "Home", icon: Home },
  { href: "/student/content-map", label: "Content Map", icon: Map },
  { href: "/student/materials", label: "Materials", icon: BookOpen },
  { href: "/student/full-tests", label: "Full Tests", icon: ClipboardList },
  { href: "/student/history", label: "History", icon: ClipboardList },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function NavStudent({ userName, isImpersonated, onExitImpersonation }: NavStudentProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-blue-700 text-sm">SAT Practice</span>
              <div className="flex items-center gap-1">
                {links.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      pathname === href || (href !== "/student" && pathname.startsWith(href))
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100"
              >
                {userName}
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 rounded-md border border-gray-200 bg-white shadow-lg z-10">
                  <button
                    onClick={() => {
                      window.location.href = "/auth/change-password";
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <KeyRound size={14} />
                    Change password
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
