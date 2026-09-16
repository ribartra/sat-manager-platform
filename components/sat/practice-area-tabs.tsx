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
    <div className={`mb-5 flex flex-wrap gap-2 border-b border-gray-200 ${className ?? ""}`}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={buildAreaHref(basePath, tab.key, preserve)}
          className={areaTabLinkClass(tab.key, active === tab.key)}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
