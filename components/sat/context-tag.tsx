import { Badge } from "@/components/ui/badge";

/** "Classroom" / "Homework" tag of a practice assignment (lists and results; never in the attempts accordion). */
export function ContextTag({ context, className }: { context: string | null | undefined; className?: string }) {
  const classroom = context === "CLASSROOM";
  return (
    <Badge variant={classroom ? "default" : "info"} className={className}>
      {classroom ? "Classroom" : "Homework"}
    </Badge>
  );
}
