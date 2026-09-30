import type { Metadata } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/session-provider";
import { AppQueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/sat/confirm-dialog";

export const metadata: Metadata = {
  title: "SAT Practice Platform",
  description: "Personalized SAT prep platform",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-gray-900 antialiased">
        <AuthSessionProvider>
          <AppQueryProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </AppQueryProvider>
        </AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
