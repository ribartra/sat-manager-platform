"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit, FileDown, Link2, Plus } from "lucide-react";
import { StudentPicker } from "@/components/student-picker";
import { errorMessage, readApiError } from "@/lib/api-client";

type Student = { id: string; name: string };
type Parent = { id: string; name: string; email: string; phone: string; students: Student[] };
type ModalMode = "add" | "edit" | "report" | null;

const REPORT_GROUPS = [
  { key: "mathematics", label: "Mathematics", areas: ["mathematics"] },
  { key: "rw", label: "Reading & Writing", areas: ["reading", "writing"] },
];

function allAreas() {
  return new Set(REPORT_GROUPS.flatMap((group) => group.areas));
}

export function ParentsClient({
  parents,
  students,
  studentsWithoutParent = [],
}: {
  parents: Parent[];
  students: Student[];
  /** Students in scope with no parent or guardian linked. */
  studentsWithoutParent?: (Student & { email: string })[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalMode>(null);
  const [activeParent, setActiveParent] = useState<Parent | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reportAreas, setReportAreas] = useState<Set<string>>(allAreas);
  const [parentSearch, setParentSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const sortedParents = useMemo(() => parents.slice().sort((a, b) => a.name.localeCompare(b.name)), [parents]);
  const filteredParents = useMemo(() => {
    const term = parentSearch.trim().toLowerCase();
    if (!term) return sortedParents;
    return sortedParents.filter((parent) =>
      [parent.name, parent.email, parent.phone, ...parent.students.map((student) => student.name)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [parentSearch, sortedParents]);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setSelectedStudentIds([]);
    setStudentId(students[0]?.id ?? "");
    setShareStatus(null);
    setReportAreas(allAreas());
    setActiveParent(null);
    setStudentSearch("");
  }

  function closeModal() {
    setModal(null);
    resetForm();
  }

  function openAdd(forStudentId?: string) {
    resetForm();
    if (forStudentId) setSelectedStudentIds([forStudentId]);
    setModal("add");
  }

  function openEdit(parent: Parent) {
    setActiveParent(parent);
    setName(parent.name);
    setEmail(parent.email);
    setPhone(parent.phone);
    setSelectedStudentIds(parent.students.map((student) => student.id));
    setModal("edit");
  }

  function openReport(parent: Parent) {
    setActiveParent(parent);
    setStudentId(parent.students[0]?.id ?? students[0]?.id ?? "");
    setReportAreas(allAreas());
    setShareStatus(null);
    setModal("report");
  }

  async function createParent(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, studentIds: selectedStudentIds }),
    });
    closeModal();
    router.refresh();
  }

  async function updateParent(e: FormEvent) {
    e.preventDefault();
    if (!activeParent) return;
    await fetch("/api/parents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        parentId: activeParent.id,
        name,
        email,
        phone,
        studentIds: selectedStudentIds,
      }),
    });
    closeModal();
    router.refresh();
  }

  async function shareReport() {
    if (!studentId || !activeParent) return;
    setSharing(true);
    setShareStatus("Sending...");
    const response = await fetch("/api/parents/access-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, parentId: activeParent.id, areas: [...reportAreas] }),
    });
    setSharing(false);
    if (!response.ok) {
      setShareStatus(errorMessage(await readApiError(response, "Could not share the report.")));
      return;
    }
    const payload = await response.json();
    if (payload.emailSent) {
      setShareStatus(`Report link emailed to ${payload.parentEmail} (${payload.sections}).`);
    } else {
      setShareStatus(
        payload.emailReason === "SMTP_NOT_CONFIGURED"
          ? "Link created, but the email was not sent. Email isn't set up yet. Ask your administrator."
          : "Link created, but the email could not be delivered."
      );
    }
  }

  function isGroupOn(group: (typeof REPORT_GROUPS)[number]) {
    return group.areas.some((area) => reportAreas.has(area));
  }

  function toggleGroup(group: (typeof REPORT_GROUPS)[number], checked: boolean) {
    setReportAreas((prev) => {
      const next = new Set(prev);
      if (checked) {
        group.areas.forEach((area) => next.add(area));
        return next;
      }
      const candidate = new Set(next);
      group.areas.forEach((area) => candidate.delete(area));
      return candidate.size > 0 ? candidate : next; // keep at least one section
    });
  }

  function reportHref() {
    return `/api/reports/students/${studentId}/pdf?areas=${encodeURIComponent([...reportAreas].join(","))}`;
  }

  const reportStudents = activeParent?.students.length ? activeParent.students : students;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{parents.length} parent{parents.length === 1 ? "" : "s"} registered</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={parentSearch}
            onChange={(event) => setParentSearch(event.target.value)}
            placeholder="Search parent or student..."
            className="w-64 text-sm"
          />
          <Button type="button" onClick={() => openAdd()} className="flex items-center gap-1.5">
            <Plus size={14} /> Add Parent
          </Button>
        </div>
      </div>

      {studentsWithoutParent.length > 0 ? (
        <Card variant="warning" padding="md">
          <h2 className="text-sm font-semibold text-amber-900">
            Students without a parent or guardian ({studentsWithoutParent.length})
          </h2>
          <p className="mt-0.5 text-xs text-amber-800">They can&apos;t receive reports by email until a parent is linked.</p>
          <ul className="mt-3 divide-y divide-amber-100">
            {studentsWithoutParent.map((student) => (
              <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/teacher/students/${student.id}`} className="font-medium text-gray-900 hover:text-[var(--sat-primary)] hover:underline">
                    {student.name}
                  </Link>
                  <span className="ml-2 text-xs text-gray-500">{student.email}</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => openAdd(student.id)}>
                  <Plus size={14} /> Add parent
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Parent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Students</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredParents.map((parent) => (
              <tr key={parent.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{parent.name}</p>
                  <p className="text-xs text-gray-500">{parent.email}</p>
                  {parent.phone && <p className="text-xs text-gray-400">{parent.phone}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {parent.students.length === 0
                    ? "None"
                    : parent.students.map((student, index) => (
                        <span key={student.id}>
                          {index > 0 ? ", " : null}
                          <Link href={`/teacher/students/${student.id}`} className="hover:text-[var(--sat-primary)] hover:underline">
                            {student.name}
                          </Link>
                        </span>
                      ))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(parent)}>
                      <Edit size={14} /> Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openReport(parent)}>
                      <FileDown size={14} /> Reports
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredParents.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No parents match the current search.</div>}
      </Card>

      <Dialog open={modal === "add"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <form onSubmit={createParent} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add Parent</DialogTitle>
              <DialogDescription>Create a parent record and select the students associated to this parent.</DialogDescription>
            </DialogHeader>
            <ParentFields name={name} email={email} phone={phone} setName={setName} setEmail={setEmail} setPhone={setPhone} />
            <StudentPicker
              mode="multi"
              label="Associated students"
              students={students}
              value={selectedStudentIds}
              onChange={setSelectedStudentIds}
              search={studentSearch}
              onSearchChange={setStudentSearch}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button type="submit">Save Parent</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "edit"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <form onSubmit={updateParent} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit Parent</DialogTitle>
              <DialogDescription>Update parent information and student associations in one place.</DialogDescription>
            </DialogHeader>
            <ParentFields name={name} email={email} phone={phone} setName={setName} setEmail={setEmail} setPhone={setPhone} />
            <StudentPicker
              mode="multi"
              label="Associated students"
              students={students}
              value={selectedStudentIds}
              onChange={setSelectedStudentIds}
              search={studentSearch}
              onSearchChange={setStudentSearch}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "report"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Share progress with parent</DialogTitle>
              <DialogDescription>
                Pick a student and the sections to include, then email a report link to the parent
                {activeParent ? ` (${activeParent.email})` : ""}. Or download the PDF.
              </DialogDescription>
            </DialogHeader>
            <StudentPicker
              mode="single"
              students={reportStudents}
              value={studentId}
              onChange={setStudentId}
            />
            <div className="flex flex-wrap gap-4">
              {REPORT_GROUPS.map((group) => (
                <label key={group.key} className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Checkbox checked={isGroupOn(group)} onChange={(e) => toggleGroup(group, e.target.checked)} />
                  {group.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={shareReport} disabled={sharing} disabledReason={!studentId ? "Choose a student." : null}>
                <Link2 size={14} /> {sharing ? "Sending..." : "Share report by email"}
              </Button>
              {studentId && (
                <a href={reportHref()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <FileDown size={14} /> Download PDF
                </a>
              )}
            </div>
            {shareStatus && <p className="text-sm text-gray-600">{shareStatus}</p>}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeModal}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParentFields({
  name,
  email,
  phone,
  setName,
  setEmail,
  setPhone,
}: {
  name: string;
  email: string;
  phone: string;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parent name" required />
      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" required />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
    </div>
  );
}
