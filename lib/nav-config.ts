import type { LucideIcon } from "lucide-react";
import {
  Users,
  UsersRound,
  FolderOpen,
  Map,
  FileText,
  Layers,
  ClipboardList,
  BookOpen,
  ShieldCheck,
  FolderCog,
  GraduationCap,
  UserCog,
  Settings,
  Sparkles,
  Home,
  Clock,
  MessageSquareWarning,
  Library,
} from "lucide-react";
import type { FeatureSettingKey } from "@/lib/app-settings";

export type NavRole = "TEACHER" | "ADMIN" | "STUDENT" | "PARENT";

export type NavLinkDef = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, item is shown only if the flag is enabled (see resolve rules). */
  feature?: FeatureSettingKey;
  /**
   * Hide from ADMIN chrome when Admin ▾ already exposes the same or master surface
   * (e.g. Groups, Programs, Subskills vs Taxonomy).
   * When true, hide for ADMIN even if the flag is on.
   */
  hideForAdmin?: boolean;
  exact?: boolean;
  /**
   * Per-account capability (not a feature flag): shown only to accounts that have it, e.g. the
   * master teacher's Teachers menu. The pages and APIs re-check it on the server (lib/rbac.ts).
   */
  capability?: NavCapability;
};

/** Per-account capabilities that unlock nav items (User.canManageTeachers → "manageTeachers"). */
export type NavCapability = "manageTeachers";

export type NavGroupDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: NavLinkDef[];
};

export type NavDirectDef = NavLinkDef & { kind?: "direct" };

export type TeacherNavEntryDef = NavGroupDef | NavDirectDef;

export type ResolvedNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type ResolvedNavGroup = {
  label: string;
  icon: LucideIcon;
  links: ResolvedNavLink[];
};

export type ResolvedNavDirect = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type ResolvedNavEntry = ResolvedNavGroup | ResolvedNavDirect;

export function isResolvedNavGroup(item: ResolvedNavEntry): item is ResolvedNavGroup {
  return "links" in item;
}

function isNavGroupDef(item: TeacherNavEntryDef): item is NavGroupDef {
  return "links" in item;
}

/**
 * Teacher sidebar (mockup `mejorada/teacher`): exactly Home · Students · Tests · Practice · History,
 * with Teachers just before History for the master teacher (the Home boxes follow this order).
 * The other teacher pages are reached from in-page "More" rows (TEACHER_MORE_LINKS) and the user
 * menu (Programs); admins also get the Admin group.
 */
export const TEACHER_NAV: TeacherNavEntryDef[] = [
  { id: "teacher.home", label: "Home", href: "/teacher", icon: Home, exact: true },
  { id: "teacher.students", label: "Students", href: "/teacher/students", icon: Users },
  { id: "teacher.tests", label: "Tests", href: "/teacher/tests", icon: ClipboardList },
  { id: "teacher.practice", label: "Practice", href: "/teacher/practice-sets", icon: BookOpen },
  // Master teacher only (User.canManageTeachers): invite / deactivate teachers, see who their students are.
  { id: "teacher.teachers", label: "Teachers", href: "/teacher/teachers", icon: GraduationCap, capability: "manageTeachers" },
  { id: "teacher.history", label: "History", href: "/teacher/history", icon: Clock },
];

/** Secondary teacher pages, shown as a "More" row on the Students and Practice pages. */
export const TEACHER_MORE_LINKS: Record<"students" | "practice", NavLinkDef[]> = {
  students: [
    {
      id: "teacher.students.groups",
      label: "Groups",
      href: "/teacher/groups",
      icon: UsersRound,
      feature: "TEACHER_GROUP_MANAGEMENT",
      hideForAdmin: true,
    },
    // Parents: a "Parents →" shortcut in the Students header, not a chip here.
  ],
  practice: [
    // Questions: a "Questions →" shortcut in the Practice and Tests headers (same area), not a chip here.
    {
      id: "teacher.practice.materials",
      label: "Materials",
      href: "/teacher/materials",
      icon: FileText,
      feature: "MATERIALS_MODULE",
    },
  ],
};

/** Teacher user-menu links (Programs lives here since the sidebar keeps the 5 mockup items). */
export const TEACHER_USER_MENU_LINKS: NavLinkDef[] = [
  {
    id: "teacher.programs",
    label: "Programs",
    href: "/teacher/programs",
    icon: FolderOpen,
    feature: "TEACHER_PROGRAM_MANAGEMENT",
    hideForAdmin: true,
  },
];

export function resolveLinks(
  links: NavLinkDef[],
  opts: { role?: string; flags: Partial<Record<FeatureSettingKey, boolean>> },
): ResolvedNavLink[] {
  return links
    .filter((link) => linkVisible(link, opts))
    .map((link) => ({ href: link.href, label: link.label, icon: link.icon, exact: link.exact }));
}

export const ADMIN_NAV_GROUP: NavGroupDef = {
  id: "admin",
  label: "Admin",
  icon: ShieldCheck,
  links: [
    { id: "admin.programs", label: "Program master", href: "/admin/programs", icon: FolderCog },
    { id: "admin.groups", label: "Groups", href: "/teacher/groups", icon: UsersRound },
    { id: "admin.teachers", label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { id: "admin.users", label: "Accounts", href: "/admin/users", icon: UserCog },
    { id: "admin.taxonomy", label: "Taxonomy", href: "/admin/taxonomy", icon: Layers },
    { id: "admin.sources", label: "Sources", href: "/admin/sources", icon: Library },
    { id: "admin.import.quick", label: "Import with AI", href: "/teacher/import", icon: Sparkles },
    { id: "admin.import.ai", label: "AI Import", href: "/admin/import/ai", icon: FileText },
    { id: "admin.reports", label: "Reports", href: "/admin/reports", icon: MessageSquareWarning },
    { id: "admin.logs", label: "Audit Log", href: "/admin/logs", icon: FileText },
    { id: "admin.settings", label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

export const STUDENT_NAV_ENROLLED: NavLinkDef[] = [
  { id: "student.home", label: "Home", href: "/student", icon: Home, exact: true },
  { id: "student.tests", label: "Tests", href: "/student/tests", icon: ClipboardList },
  { id: "student.practice", label: "Practice", href: "/student/practice", icon: Map },
  {
    id: "student.materials",
    label: "Materials",
    href: "/student/materials",
    icon: BookOpen,
    feature: "MATERIALS_MODULE",
  },
  { id: "student.history", label: "History", href: "/student/history", icon: Clock },
];

export const STUDENT_NAV_RESTRICTED: NavLinkDef[] = [
  { id: "student.program", label: "Programs", href: "/student/program", icon: FolderOpen },
];

function linkVisible(
  link: NavLinkDef,
  opts: { role?: string; flags: Partial<Record<FeatureSettingKey, boolean>>; capabilities?: NavCapability[] },
): boolean {
  if (link.hideForAdmin && opts.role === "ADMIN") return false;
  if (link.capability && !opts.capabilities?.includes(link.capability)) return false;
  if (!link.feature) return true;
  return Boolean(opts.flags[link.feature]);
}

export function resolveTeacherNav(opts: {
  role?: string;
  flags: Partial<Record<FeatureSettingKey, boolean>>;
  capabilities?: NavCapability[];
}): ResolvedNavEntry[] {
  const entries: ResolvedNavEntry[] = [];

  for (const item of TEACHER_NAV) {
    if (isNavGroupDef(item)) {
      const links = item.links
        .filter((link) => linkVisible(link, opts))
        .map((link) => ({ href: link.href, label: link.label, icon: link.icon, exact: link.exact }));
      if (links.length === 0) continue;
      entries.push({ label: item.label, icon: item.icon, links });
      continue;
    }
    if (!linkVisible(item, opts)) continue;
    entries.push({ href: item.href, label: item.label, icon: item.icon, exact: item.exact });
  }

  if (opts.role === "ADMIN") {
    entries.push({
      label: ADMIN_NAV_GROUP.label,
      icon: ADMIN_NAV_GROUP.icon,
      links: ADMIN_NAV_GROUP.links.map((link) => ({
        href: link.href,
        label: link.label,
        icon: link.icon,
      })),
    });
  }

  return entries;
}

export function resolveStudentNav(opts: {
  hasActiveEnrollment: boolean;
  flags: Partial<Record<FeatureSettingKey, boolean>>;
}): ResolvedNavLink[] {
  const source = opts.hasActiveEnrollment ? STUDENT_NAV_ENROLLED : STUDENT_NAV_RESTRICTED;
  return source
    .filter((link) => linkVisible(link, { flags: opts.flags }))
    .map((link) => ({ href: link.href, label: link.label, icon: link.icon, exact: link.exact }));
}

/** Other paths that belong to a nav item (detail pages living outside its prefix, legacy URLs). */
const NAV_ALIASES: Record<string, string[]> = {
  "/student/tests": ["/student/full-tests"],
  "/student/practice": ["/student/content-map", "/student/results"],
  "/teacher/tests": ["/teacher/full-tests"],
  "/teacher/students": ["/teacher/groups", "/teacher/parents", "/teacher/impersonate"],
  "/teacher/practice-sets": ["/teacher/questions", "/teacher/materials"],
  "/teacher/teachers": [],
};

/**
 * Path the sidebar highlights for: the Question Bank on its Tests tab belongs to Tests (the other tabs
 * to Practice, via NAV_ALIASES).
 */
export function navPathname(pathname: string, area: string | null | undefined): string {
  return pathname.startsWith("/teacher/questions") && area === "tests" ? "/teacher/tests/questions" : pathname;
}

export function linkIsActive(href: string, pathname: string, exact = false): boolean {
  if (exact || href === "/teacher" || href === "/student") return pathname === href;
  return [href, ...(NAV_ALIASES[href] ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function groupIsActive(group: ResolvedNavGroup, pathname: string): boolean {
  return group.links.some((link) => linkIsActive(link.href, pathname, link.exact));
}

export function hrefWithArea(href: string, area: string | null | undefined): string {
  if (!area || !["math", "reading", "writing", "tests"].includes(area)) return href;
  const areaAware = [
    "/student/practice",
    "/student/history",
    "/student/materials",
    "/teacher/questions",
    "/teacher/practice-sets",
  ];
  const url = new URL(href, "http://sat.local");
  if (!areaAware.includes(url.pathname)) return href;
  if (!url.searchParams.has("area")) url.searchParams.set("area", area);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function isPlayerPath(pathname: string, search?: { get(name: string): string | null } | null): boolean {
  // Student practice sets and Tests open on an intro page with the normal chrome; the player
  // itself (full screen, no nav) is the same URL with ?start=1.
  const studentPlayer = [/^\/student\/practice\/assignment\/[^/]+$/, /^\/student\/tests\/(?!results$)[^/]+$/];
  if (studentPlayer.some((pattern) => pattern.test(pathname))) return search?.get("start") === "1";
  return [
    /^\/student\/full-tests\/[^/]+$/,
    /^\/teacher\/practice-sets\/[^/]+\/preview$/,
    /^\/teacher\/full-tests\/[^/]+\/preview$/,
    /^\/teacher\/tests\/[^/]+\/preview$/,
  ].some((pattern) => pattern.test(pathname));
}

/** The Home of each portal (first breadcrumb on pages shared by several roles). */
export function homeHrefForRole(role: string | null | undefined): string {
  if (role === "STUDENT") return "/student";
  if (role === "PARENT") return "/parent";
  return "/teacher";
}
