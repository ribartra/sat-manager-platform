import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AuthSessionProvider } from "@/components/session-provider";
import { AppQueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/sat/confirm-dialog";
import { CspNonce } from "@/components/csp-nonce";

export const metadata: Metadata = {
  title: "SAT Practice Platform",
  description: "Personalized SAT prep platform",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-gray-900 antialiased">
        <CspNonce nonce={nonce} />
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
