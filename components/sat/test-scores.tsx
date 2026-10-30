/** Test section scores in the area colours (R&W orange, Math blue), as in the students table. */
export function Scores({ rw, math }: { rw: number | null; math: number | null }) {
  return (
    <>
      <span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b>{rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b>{math ?? "—"}</b>
    </>
  );
}
