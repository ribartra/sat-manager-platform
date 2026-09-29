import Link from "next/link";
import {
  AREA_TABS_WITH_MOCKS,
  PRACTICE_AREA_TABS,
  areaTabLinkClass,
  buildAreaHref,
  type AreaTabKey,
} from "@/lib/practice-area";

interface PracticeAreaTabsProps {
  basePath: string;
  active: AreaTabKey;
  /** Preserve selected student (or other query params) across tab switches. */
  preserve?: Record<string, string | undefined | null>;
  includeMocks?: boolean;
  className?: string;
}

export function PracticeAreaTabs({
  basePath,
  active,
  preserve,
  includeMocks = true,
  className,
}: PracticeAreaTabsProps) {
  const tabs = includeMocks ? AREA_TABS_WITH_MOCKS : PRACTICE_AREA_TABS;

  return (
    <nav aria-label="Practice area" className={`-mx-1 overflow-x-auto border-b border-gray-200 ${className?.match(/(^|\s)mb-/) ? "" : "mb-5"} ${className ?? ""}`}>
      <div className="flex min-w-max gap-1 px-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={buildAreaHref(basePath, tab.key, preserve)}
            className={`${areaTabLinkClass(tab.key, active === tab.key)} whitespace-nowrap`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
