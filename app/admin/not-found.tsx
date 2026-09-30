import Link from "next/link";
import { PageShell } from "@/components/sat";

export default function NotFound() {
  return (
    <PageShell>
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">The page you are looking for does not exist or is not enabled.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        Go to the home page
      </Link>
    </PageShell>
  );
}
