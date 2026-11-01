import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthSessionProvider } from "@/components/session-provider";
import { AppQueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/sat/confirm-dialog";
import { CspNonce } from "@/components/csp-nonce";

// Mockup typeface, self-hosted at build time (no runtime request to Google).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

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
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full antialiased">
        <CspNonce nonce={nonce} />
        <AuthSessionProvider>
          <AppQueryProvider>
            {/* Desktop scale (globals.css): portals (menus, dialogs, toasts) stay outside it. */}
            <div className="app-zoom min-h-full">
              <ConfirmProvider>{children}</ConfirmProvider>
            </div>
          </AppQueryProvider>
        </AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
