import type { LucideIcon } from "lucide-react";
import {
  Users,
  UsersRound,
  UserCheck,
  FolderOpen,
  Map,
  FileText,
  HelpCircle,
  Layers,
  ClipboardList,
  BarChart2,
  BookOpen,
  ShieldCheck,
  FolderCog,
  GraduationCap,
  UserCog,
  Settings,
  Home,
  Clock,
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
};

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
};

export type ResolvedNavEntry = ResolvedNavGroup | ResolvedNavDirect;

export function isResolvedNavGroup(item: ResolvedNavEntry): item is ResolvedNavGroup {
  return "links" in item;
}

function isNavGroupDef(item: TeacherNavEntryDef): item is NavGroupDef {
  return "links" in item;
}

/** Declarative Teacher (+ Admin) navigation. Desktop, drawer and future crumbs share this. */
export const TEACHER_NAV: TeacherNavEntryDef[] = [
  {
    id: "teacher.students",
    label: "Students",
    icon: Users,
    links: [
      { id: "teacher.students.list", label: "Students", href: "/teacher", icon: Users },
      {
        id: "teacher.students.groups",
        label: "Groups",
        href: "/teacher/groups",
        icon: UsersRound,
        feature: "TEACHER_GROUP_MANAGEMENT",
        hideForAdmin: true,
      },
      { id: "teacher.students.parents", label: "Parents", href: "/teacher/parents", icon: UserCheck },
    ],
  },
  {
    id: "teacher.programs",
    label: "Programs",
    href: "/teacher/programs",
    icon: FolderOpen,
    feature: "TEACHER_PROGRAM_MANAGEMENT",
    hideForAdmin: true,
  },
  {
    id: "teacher.content",
    label: "Content",
    icon: FileText,
    links: [
      { id: "teacher.content.map", label: "Content Map", href: "/teacher/content", icon: Map },
      {
        id: "teacher.content.materials",
        label: "Materials",
        href: "/teacher/materials",
        icon: FileText,
        feature: "MATERIALS_MODULE",
      },
      { id: "teacher.content.questions", label: "Questions", href: "/teacher/questions", icon: HelpCircle },
    ],
  },
  {
    id: "teacher.assessments",
    label: "Assessments",
    icon: ClipboardList,
    links: [
      { id: "teacher.assessments.practice-sets", label: "Practice & Exams", href: "/teacher/practice-sets", icon: BookOpen },
      { id: "teacher.assessments.compare", label: "Compare", href: "/teacher/compare", icon: BarChart2 },
    ],
  },
];

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
    { id: "admin.import.ai", label: "AI Import", href: "/admin/import/ai", icon: FileText },
    { id: "admin.logs", label: "Audit Log", href: "/admin/logs", icon: FileText },
    { id: "admin.settings", label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

export const STUDENT_NAV_ENROLLED: NavLinkDef[] = [
  { id: "student.home", label: "Home", href: "/student", icon: Home, exact: true },
  { id: "student.content-map", label: "Content Map", href: "/student/content-map", icon: Map },
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
  opts: { role?: string; flags: Partial<Record<FeatureSettingKey, boolean>> },
): boolean {
  if (link.hideForAdmin && opts.role === "ADMIN") return false;
  if (!link.feature) return true;
  return Boolean(opts.flags[link.feature]);
}

export function resolveTeacherNav(opts: {
  role?: string;
  flags: Partial<Record<FeatureSettingKey, boolean>>;
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
    entries.push({ href: item.href, label: item.label, icon: item.icon });
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

export function linkIsActive(href: string, pathname: string, exact = false): boolean {
  if (exact || href === "/teacher" || href === "/student") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function groupIsActive(group: ResolvedNavGroup, pathname: string): boolean {
  return group.links.some((link) => linkIsActive(link.href, pathname, link.exact));
}

export function hrefWithArea(href: string, area: string | null | undefined): string {
  if (!area || !["math", "reading", "writing", "mocks"].includes(area)) return href;
  const areaAware = [
    "/student",
    "/student/content-map",
    "/student/history",
    "/student/materials",
    "/teacher",
    "/teacher/content",
    "/teacher/questions",
    "/teacher/practice-sets",
    "/teacher/compare",
  ];
  const url = new URL(href, "http://sat.local");
  if (!areaAware.includes(url.pathname)) return href;
  if (!url.searchParams.has("area")) url.searchParams.set("area", area);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function isPlayerPath(pathname: string): boolean {
  return [
    /^\/student\/practice\/assignment\/[^/]+$/,
    /^\/student\/full-tests\/[^/]+$/,
    /^\/teacher\/practice-sets\/[^/]+\/preview$/,
    /^\/teacher\/full-tests\/[^/]+\/preview$/,
  ].some((pattern) => pattern.test(pathname));
}
