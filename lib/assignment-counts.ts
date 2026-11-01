// How an item (a practice set or a Test) is going with the teacher's students: assigned, completed,
// in progress (an open try), overdue (past the due date and not completed). One rule for the Tests
// list, the Practice catalogue (hover) and the item's page.

export interface AssignmentCounts {
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

export function assignmentCounts(
  assignments: Array<{ status: string; dueDate: Date | null; attempts?: Array<unknown> }>,
  now = new Date(),
): AssignmentCounts {
  return {
    assigned: assignments.length,
    completed: assignments.filter((a) => a.status === "COMPLETED").length,
    inProgress: assignments.filter((a) => (a.attempts?.length ?? 0) > 0 || a.status === "IN_PROGRESS").length,
    overdue: assignments.filter((a) => a.status === "OVERDUE" || (a.status !== "COMPLETED" && a.dueDate && a.dueDate < now)).length,
  };
}

export function addCounts(list: AssignmentCounts[]): AssignmentCounts {
  return list.reduce((sum, c) => ({ assigned: sum.assigned + c.assigned, completed: sum.completed + c.completed, inProgress: sum.inProgress + c.inProgress, overdue: sum.overdue + c.overdue }), {
    assigned: 0,
    completed: 0,
    inProgress: 0,
    overdue: 0,
  });
}

/** "Assigned 4 · Completed 2 · In progress 1 · Overdue 1" */
export function countsLabel(c: AssignmentCounts): string {
  return `Assigned ${c.assigned} · Completed ${c.completed} · In progress ${c.inProgress} · Overdue ${c.overdue}`;
}
