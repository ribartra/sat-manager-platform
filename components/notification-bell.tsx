"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationFeed = { notifications: Notification[]; total: number; unread: number };

/** The latest 10 notifications plus the total and unread counts (the rest: /notifications). */
async function fetchNotifications(): Promise<NotificationFeed> {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("Unable to load notifications.");
  const data = await res.json();
  const notifications: Notification[] = data.notifications ?? [];
  return { notifications, total: data.total ?? notifications.length, unread: data.unread ?? notifications.filter((n) => !n.readAt).length };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NotificationItem({
  n,
  onClose,
}: {
  n: Notification;
  onClose: () => void;
}) {
  const unread = !n.readAt;
  const inner = (
    <div
      className={`flex items-start gap-3 border-b border-gray-50 px-4 py-3 last:border-b-0 hover:bg-gray-50 ${
        unread ? "bg-blue-50/40" : ""
      }`}
    >
      {unread && (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
      )}
      <div className={`min-w-0 flex-1 ${!unread ? "pl-[10px]" : ""}`}>
        <p
          className={`text-sm leading-snug ${
            unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"
          }`}
        >
          {n.title}
        </p>
        {n.body && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
    </div>
  );

  if (n.href) {
    return (
      <Link href={n.href} onClick={onClose} className="block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

/**
 * Notifications button for the left sidebar (mockup `.sbtn#bellBtn`): bell + label + unread dot.
 * The panel opens to the right of the button, bottom-aligned (full width on phones).
 */
export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const { data: feed, isFetching, refetch } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: fetchNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (!res.ok) throw new Error("Unable to mark notifications as read.");
    },
    onSuccess: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationFeed>(queryKeys.notifications.all, (prev) =>
        prev ? { ...prev, unread: 0, notifications: prev.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })) } : prev,
      );
    },
  });

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function toggle() {
    if (!open) {
      if (buttonRef.current) setPos(sidePopoverPosition(buttonRef.current));
      const result = await refetch();
      if ((result.data?.unread ?? 0) > 0) {
        markRead.mutate();
      }
    }
    setOpen((v) => !v);
  }

  const notifications = feed?.notifications ?? [];
  const total = feed?.total ?? 0;
  const unreadCount = feed?.unread ?? 0;
  const loading = open && isFetching && notifications.length === 0;

  return (
    <div ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative flex w-full items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-slate-100"
      >
        <Bell size={18} className="shrink-0" />
        <span className={collapsed ? "min-[860px]:hidden" : ""}>Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute left-[17px] top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={pos}
          className="fixed z-50 w-[330px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl max-[859px]:!left-3 max-[859px]:!right-3 max-[859px]:!w-auto"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {notifications.length > 0 && (
              <span className="text-xs text-gray-400">
                {unreadCount === 0 ? "All read" : `${unreadCount} unread`}
              </span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onClose={() => setOpen(false)} />
              ))
            )}
          </div>
          {/* The latest 10 here; the rest on /notifications (25 per page, period filter). */}
          {total > notifications.length ? (
            <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-gray-100 px-4 py-2.5 text-sm font-medium text-blue-600 hover:underline">
              See all {total} notifications →
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Fixed position for a popover opening to the right of a sidebar button, bottom-aligned. */
export function sidePopoverPosition(anchor: HTMLElement): React.CSSProperties {
  const r = anchor.getBoundingClientRect();
  return { left: r.right + 8, bottom: Math.max(12, window.innerHeight - r.bottom) };
}
