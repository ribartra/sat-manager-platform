import { redirect } from "next/navigation";

// Bulk question import (CSV rows) was discarded: content comes in as whole Practice Sets / Tests with
// Import with AI. Old links land there.
export default function BulkImportPage() {
  redirect("/teacher/import");
}
