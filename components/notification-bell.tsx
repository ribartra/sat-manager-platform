"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Initial fetch for unread badge count
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []));
  }, []);

  // Close on outside click
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
      setLoading(true);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      const fetched: Notification[] = data.notifications ?? [];
      setNotifications(fetched);
      setLoading(false);

      // Mark all unread as read
      if (fetched.some((n) => !n.readAt)) {
        fetch("/api/notifications", { method: "PATCH" });
        setNotifications(fetched.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      }
    }
    setOpen((v) => !v);
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        <Bell size={14} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {notifications.length > 0 && (
              <span className="text-xs text-gray-400">
                {notifications.filter((n) => !n.readAt).length === 0
                  ? "All read"
                  : `${notifications.filter((n) => !n.readAt).length} unread`}
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
        </div>
      )}
    </div>
  );
}
