"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Users, BookOpen, ClipboardList, Settings, ChevronDown, KeyRound, LogOut, Bell } from "lucide-react";
import { useState } from "react";

interface NavTeacherProps {
  userName: string;
  role?: string;
}

const links = [
  { href: "/teacher", label: "Students", icon: Users },
  { href: "/teacher/programs", label: "Programs", icon: BookOpen },
  { href: "/teacher/content", label: "Content", icon: BookOpen },
  { href: "/teacher/materials", label: "Materials", icon: BookOpen },
  { href: "/teacher/full-tests", label: "Full Tests", icon: ClipboardList },
  { href: "/teacher/compare", label: "Compare", icon: Users },
  { href: "/teacher/questions", label: "Questions", icon: ClipboardList },
  { href: "/teacher/subskills", label: "Subskills", icon: BookOpen },
  { href: "/teacher/groups", label: "Groups", icon: Settings },
  { href: "/teacher/parents", label: "Parents", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

export function NavTeacher({ userName, role }: NavTeacherProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleLinks = role === "ADMIN"
    ? [...links, { href: "/admin/programs", label: "Admin Programs", icon: BookOpen }, { href: "/admin/teachers", label: "Teachers", icon: Users }, { href: "/admin/users", label: "Accounts", icon: Users }]
    : links;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-blue-700 text-sm">SAT Platform</span>
            <div className="flex items-center gap-1">
              {visibleLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    pathname === href || (href !== "/teacher" && pathname.startsWith(href))
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
  );
}
