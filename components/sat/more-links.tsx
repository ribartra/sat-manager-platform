import Link from "next/link";
import type { ResolvedNavLink } from "@/lib/nav-config";

/** "More" row of secondary pages under a section heading (the sidebar keeps only the main items). */
export function MoreLinks({ links, label = "More" }: { links: ResolvedNavLink[]; label?: string }) {
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700 hover:border-gray-400"
        >
          <link.icon size={14} className="text-gray-400" />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
