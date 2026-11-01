"use client";

import "./globals.css";
import { RouteError } from "@/components/sat/route-error";

// Last resort when the root layout itself fails: renders its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-white text-gray-900 antialiased">
        <RouteError title="The platform could not be loaded" reset={reset} back={{ href: "/", label: "Reload the home page" }} />
      </body>
    </html>
  );
}
