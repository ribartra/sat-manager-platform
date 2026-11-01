"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { enrollmentStatusLabel } from "@/lib/domain-meta";

type Enrollment = {
  studentId: string;
  status: string;
  active: boolean;
  enrolledAt: string;
  parentApprovedAt: string | null;
  student: { id: string; name: string };
};

type Program = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  enrollments: Enrollment[];
};

function programStatus(p: Pick<Program, "active" | "startDate" | "endDate">) {
  const now = new Date();
  if (!p.active) return "inactive";
  if (new Date(p.startDate) > now) return "scheduled";
  if (p.endDate && new Date(p.endDate) <= now) return "closed";
  return "active";
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  scheduled: "info",
  closed: "warning",
  inactive: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  closed: "Closed",
  inactive: "Inactive",
};

const ENROLLMENT_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
};

function fmt(d: string) {
  return d.slice(0, 10);
}

// ─── Create Program Form ──────────────────────────────────────────────────────

function CreateProgramForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate: startDate || null, endDate: endDate || null }),
    });
    setSaving(false);
    onDone();
    router.refresh();
  }

  return (
    <Card as="form" onSubmit={submit} variant="info" padding="md" className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-blue-900">New Program</h3>
      <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_auto_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Program name"
          required
        />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

// ─── Edit Program Form ────────────────────────────────────────────────────────

function EditProgramForm({
  program,
  onDone,
}: {
  program: Program;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(program.name);
  const [startDate, setStartDate] = useState(program.startDate.slice(0, 10));
  const [endDate, setEndDate] = useState(program.endDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/programs/${program.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate: endDate || null }),
    });
    setSaving(false);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Program name"
          required
        />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Pending Request Row (compact, used in summary panel) ────────────────────

function PendingRow({
  programId,
  programName,
  enrollment,
}: {
  programId: string;
  programName: string;
  enrollment: Enrollment;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    await fetch(`/api/programs/${programId}/enrollments/${enrollment.studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-amber-900">{programName}</span>
        <span className="text-amber-300">·</span>
        <span className="text-sm text-amber-800">{enrollment.student.name}</span>
        <span className="text-xs text-amber-500">{fmt(enrollment.enrolledAt)}</span>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-green-700 hover:bg-green-50"
          onClick={() => act("approve")}
          disabled={!!loading}
        >
          {loading === "approve" ? "..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-red-600 hover:bg-red-50"
          onClick={() => act("reject")}
          disabled={!!loading}
        >
          {loading === "reject" ? "..." : "Reject"}
        </Button>
      </div>
    </div>
  );
}

// ─── Enrollment Row (full, used in expandable section) ───────────────────────

function EnrollmentRow({
  programId,
  enrollment,
}: {
  programId: string;
  enrollment: Enrollment;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    await fetch(`/api/programs/${programId}/enrollments/${enrollment.studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Approved, active students open their page; pending ones are not in the program yet. */}
        {enrollment.status === "APPROVED" && enrollment.active ? (
          <Link href={`/teacher/students/${enrollment.studentId}`} className="text-sm font-medium text-gray-800 hover:text-[var(--sat-primary)] hover:underline">
            {enrollment.student.name}
          </Link>
        ) : (
          <span className="text-sm font-medium text-gray-800">{enrollment.student.name}</span>
        )}
        <Badge variant={ENROLLMENT_VARIANT[enrollment.status]}>{enrollmentStatusLabel(enrollment.status)}</Badge>
        <span className="text-xs text-gray-400">{fmt(enrollment.enrolledAt)}</span>
      </div>
      <div className="flex gap-1">
        {enrollment.status === "PENDING" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-green-700 hover:bg-green-50"
              onClick={() => act("approve")}
              disabled={!!loading}
            >
              {loading === "approve" ? "..." : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-red-600 hover:bg-red-50"
              onClick={() => act("reject")}
              disabled={!!loading}
            >
              {loading === "reject" ? "..." : "Reject"}
            </Button>
          </>
        )}
        {enrollment.status === "APPROVED" && enrollment.active && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-gray-500 hover:bg-gray-100"
            onClick={() => act("remove")}
            disabled={!!loading}
          >
            {loading === "remove" ? "..." : "Remove"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Teacher Programs Client ─────────────────────────────────────────────

export function TeacherProgramsClient({ programs }: { programs: Program[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }

  function toggleEdit(id: string) {
    setEditingId((prev) => (prev === id ? null : id));
    setExpandedId(null);
  }

  const allPending = programs.flatMap((p) =>
    p.enrollments.filter((e) => e.status === "PENDING").map((e) => ({ program: p, enrollment: e }))
  );

  return (
    <div>
      {/* Pending enrollment requests summary */}
      {allPending.length > 0 && (
        <Card variant="warning" padding="md" className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">
            Requests waiting for approval
          </h2>
          <div className="divide-y divide-amber-100">
            {allPending.map(({ program, enrollment }) => (
              <PendingRow
                key={`${program.id}-${enrollment.studentId}`}
                programId={program.id}
                programName={program.name}
                enrollment={enrollment}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Create button */}
      <div className="mb-4 flex justify-end">
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + New Program
          </Button>
        )}
      </div>
      {showCreate && <CreateProgramForm onDone={() => setShowCreate(false)} />}

      {/* Programs table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Program</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Students</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((program) => {
              const status = programStatus(program);
              const isEditing = editingId === program.id;
              const isExpanded = expandedId === program.id;
              const approvedCount = program.enrollments.filter(
                (e) => e.status === "APPROVED" && e.active
              ).length;
              const pendingCount = program.enrollments.filter(
                (e) => e.status === "PENDING"
              ).length;

              return (
                <React.Fragment key={program.id}>
                  <tr
                    className={`border-t border-gray-100 ${
                      isEditing || isExpanded ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{program.name}</p>
                      {pendingCount > 0 && (
                        <span className="text-xs text-amber-600">
                          {pendingCount} waiting for approval
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmt(program.startDate)}
                      <span className="mx-1 text-gray-300">→</span>
                      {program.endDate ? (
                        fmt(program.endDate)
                      ) : (
                        <span className="text-gray-400">∞</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{approvedCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => toggleEdit(program.id)}
                        >
                          {isEditing ? "Close" : "Edit"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-gray-400"
                          onClick={() => toggleExpand(program.id)}
                        >
                          {isExpanded ? "▲" : "▼"}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-t border-amber-200 bg-amber-50 px-4 py-4"
                      >
                        <EditProgramForm
                          program={program}
                          onDone={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}

                  {isExpanded && !isEditing && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-t border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Students
                        </p>
                        {program.enrollments.length === 0 ? (
                          <p className="py-2 text-xs text-gray-400">No students yet.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {program.enrollments.map((e) => (
                              <EnrollmentRow
                                key={e.studentId}
                                programId={program.id}
                                enrollment={e}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {programs.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No programs yet.</p>
        )}
      </Card>
    </div>
  );
}
