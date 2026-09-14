"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  createProgramSchema,
  editProgramSchema,
  type CreateProgramInput,
  type EditProgramInput,
} from "@/contracts/admin";

type Teacher = { id: string; name: string; email: string };

type Enrollment = {
  studentId: string;
  status: string;
  active: boolean;
  enrolledAt: string;
  student: { id: string; name: string };
};

type ProgramTeacher = {
  programId: string;
  teacherId: string;
  startDate: string;
  endDate: string | null;
  teacher: { id: string; name: string; email: string };
};

type Program = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  deletedAt: string | null;
  teachers: ProgramTeacher[];
  enrollments: Enrollment[];
};

function programStatus(p: Pick<Program, "active" | "deletedAt" | "startDate" | "endDate">) {
  if (p.deletedAt) return "deleted";
  const now = new Date();
  if (!p.active) return "inactive";
  if (new Date(p.startDate) > now) return "scheduled";
  if (p.endDate && new Date(p.endDate) <= now) return "closed";
  return "active";
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  active: "success",
  scheduled: "info",
  closed: "warning",
  inactive: "danger",
  deleted: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  closed: "Closed",
  inactive: "Inactive",
  deleted: "Deleted",
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

function CreateProgramForm({
  teachers,
  onDone,
}: {
  teachers: Teacher[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [teacherSearch, setTeacherSearch] = useState("");
  const form = useForm<CreateProgramInput>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: { name: "", teacherId: "", startDate: "", endDate: "" },
  });
  const teacherId = form.watch("teacherId");
  const visibleTeachers = useMemo(() => {
    const term = teacherSearch.trim().toLowerCase();
    const filtered = term
      ? teachers.filter((teacher) => teacher.name.toLowerCase().includes(term) || teacher.email.toLowerCase().includes(term))
      : teachers;
    const selected = teachers.find((teacher) => teacher.id === teacherId);
    return selected && !filtered.some((teacher) => teacher.id === selected.id) ? [selected, ...filtered] : filtered;
  }, [teacherId, teacherSearch, teachers]);

  async function onSubmit(values: CreateProgramInput) {
    await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        teacherId: values.teacherId,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      }),
    });
    onDone();
    router.refresh();
  }

  const saving = form.formState.isSubmitting;

  return (
    <Card variant="info" padding="md" className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-blue-900">New Program</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_150px_150px_auto_auto]" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Program name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Input
            value={teacherSearch}
            onChange={(event) => setTeacherSearch(event.target.value)}
            placeholder="Search teacher..."
          />
          <FormField
            control={form.control}
            name="teacherId"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Select {...field}>
                    <option value="">Select teacher</option>
                    {visibleTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.email}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </form>
      </Form>
    </Card>
  );
}

// ─── Edit Program Form (inline, admin) ───────────────────────────────────────

function EditProgramForm({
  program,
  teachers,
  onDone,
}: {
  program: Program;
  teachers: Teacher[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [newTeacherId, setNewTeacherId] = useState("");
  const [teacherLoading, setTeacherLoading] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const form = useForm<EditProgramInput>({
    resolver: zodResolver(editProgramSchema),
    defaultValues: {
      name: program.name,
      startDate: program.startDate.slice(0, 10),
      endDate: program.endDate?.slice(0, 10) ?? "",
      active: program.active,
    },
  });

  const activeTeachers = program.teachers.filter((t) => !t.endDate);
  const availableTeachers = teachers.filter(
    (t) => !activeTeachers.some((at) => at.teacherId === t.id)
  );
  const availableTeacherTerm = teacherSearch.trim().toLowerCase();
  const availableTeacherMatches = availableTeacherTerm
    ? availableTeachers.filter((teacher) => teacher.name.toLowerCase().includes(availableTeacherTerm) || teacher.email.toLowerCase().includes(availableTeacherTerm))
    : availableTeachers;
  const selectedAvailableTeacher = availableTeachers.find((teacher) => teacher.id === newTeacherId);
  const visibleAvailableTeachers =
    selectedAvailableTeacher && !availableTeacherMatches.some((teacher) => teacher.id === selectedAvailableTeacher.id)
      ? [selectedAvailableTeacher, ...availableTeacherMatches]
      : availableTeacherMatches;

  async function onSubmit(values: EditProgramInput) {
    await fetch(`/api/programs/${program.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate || null,
        active: values.active,
      }),
    });
    onDone();
    router.refresh();
  }

  async function removeTeacher(teacherId: string) {
    setTeacherLoading(teacherId);
    await fetch(`/api/programs/${program.id}/teachers/${teacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove" }),
    });
    setTeacherLoading(null);
    router.refresh();
  }

  async function addTeacher() {
    if (!newTeacherId) return;
    setTeacherLoading("add");
    await fetch(`/api/programs/${program.id}/teachers/${newTeacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add" }),
    });
    setNewTeacherId("");
    setTeacherLoading(null);
    router.refresh();
  }

  const saving = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto_auto_auto]">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input placeholder="Program name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    name={field.name}
                  />
                  Active
                </label>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Teachers
          </p>
          <div className="space-y-1.5">
            {activeTeachers.map((t) => (
              <div
                key={t.teacherId}
                className="flex items-center justify-between rounded bg-white px-3 py-1.5 border border-gray-100"
              >
                <span className="text-sm">
                  {t.teacher.name}{" "}
                  <span className="text-gray-400 text-xs">({t.teacher.email})</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-red-600 hover:bg-red-50"
                  onClick={() => removeTeacher(t.teacherId)}
                  disabled={teacherLoading === t.teacherId}
                >
                  {teacherLoading === t.teacherId ? "..." : "Remove"}
                </Button>
              </div>
            ))}
            {availableTeachers.length > 0 && (
              <div className="grid gap-2 pt-1 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  placeholder="Search teacher..."
                />
                <Select
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                >
                  <option value="">Assign teacher…</option>
                  {visibleAvailableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.email}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addTeacher}
                  disabled={!newTeacherId || teacherLoading === "add"}
                >
                  {teacherLoading === "add" ? "..." : "Assign"}
                </Button>
              </div>
            )}
            {activeTeachers.length === 0 && availableTeachers.length === 0 && (
              <p className="text-xs text-gray-400">No active teachers available.</p>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}

// ─── Enrollment Row ───────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-800">
          {enrollment.student.name}
        </span>
        <Badge variant={ENROLLMENT_VARIANT[enrollment.status]}>
          {enrollment.status}
        </Badge>
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

// ─── Main Admin Client ────────────────────────────────────────────────────────

export function AdminProgramsClient({
  programs,
  teachers,
}: {
  programs: Program[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [programSearch, setProgramSearch] = useState("");

  const hasDeleted = programs.some((p) => !!p.deletedAt);
  const visible = programs.filter((p) => {
    const term = programSearch.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.teachers.some((teacher) => teacher.teacher.name.toLowerCase().includes(term) || teacher.teacher.email.toLowerCase().includes(term)) ||
      p.enrollments.some((enrollment) => enrollment.student.name.toLowerCase().includes(term));
    return (showDeleted || !p.deletedAt) && matchesSearch;
  });

  async function softDelete(id: string) {
    setLoadingId(id);
    await fetch(`/api/programs/${id}`, { method: "DELETE" });
    setLoadingId(null);
    router.refresh();
  }

  async function restore(id: string) {
    setLoadingId(id);
    await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    setLoadingId(null);
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }

  function toggleEdit(id: string) {
    setEditingId((prev) => (prev === id ? null : id));
    setExpandedId(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          value={programSearch}
          onChange={(event) => setProgramSearch(event.target.value)}
          placeholder="Search program, teacher or student..."
          className="max-w-sm"
        />
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            + New Program
          </Button>
        )}
      </div>

      {showCreate && (
        <CreateProgramForm teachers={teachers} onDone={() => setShowCreate(false)} />
      )}

      {hasDeleted && (
        <button
          className="mb-3 text-xs text-gray-400 underline hover:text-gray-600"
          onClick={() => setShowDeleted((v) => !v)}
        >
          {showDeleted ? "Hide deleted programs" : "Show deleted programs"}
        </button>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Program</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Teacher</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Period</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Students</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((program) => {
              const status = programStatus(program);
              const isEditing = editingId === program.id;
              const isExpanded = expandedId === program.id;
              const isDeleted = !!program.deletedAt;
              const activeTeachers = program.teachers.filter((t) => !t.endDate);
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
                      isEditing || isExpanded ? "bg-amber-50/40" : isDeleted ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p
                        className={`font-medium ${
                          isDeleted ? "line-through text-gray-400" : "text-gray-900"
                        }`}
                      >
                        {program.name}
                      </p>
                      {pendingCount > 0 && (
                        <span className="text-xs text-amber-600">
                          {pendingCount} pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {activeTeachers.length > 0
                        ? activeTeachers.map((t) => t.teacher.name).join(", ")
                        : <span className="text-gray-400">—</span>}
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
                        {!isDeleted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => toggleEdit(program.id)}
                          >
                            {isEditing ? "Close" : "Edit"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-gray-400"
                          onClick={() => toggleExpand(program.id)}
                        >
                          {isExpanded ? "▲" : "▼"}
                        </Button>
                        {!isDeleted ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:bg-red-50"
                            onClick={() => softDelete(program.id)}
                            disabled={loadingId === program.id}
                          >
                            {loadingId === program.id ? "..." : "Delete"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-blue-600 hover:bg-blue-50"
                            onClick={() => restore(program.id)}
                            disabled={loadingId === program.id}
                          >
                            {loadingId === program.id ? "..." : "Restore"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-t border-amber-200 bg-amber-50 px-4 py-4"
                      >
                        <EditProgramForm
                          program={program}
                          teachers={teachers}
                          onDone={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}

                  {isExpanded && !isEditing && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-t border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Enrollments
                        </p>
                        {program.enrollments.length === 0 ? (
                          <p className="py-2 text-xs text-gray-400">
                            No enrollment records yet.
                          </p>
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
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No programs.</p>
        )}
      </Card>
    </div>
  );
}
