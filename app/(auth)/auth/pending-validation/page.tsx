import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PendingValidationPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, validationStatus: true },
  });

  if (!user) redirect("/login");
  if (user.validationStatus === "APPROVED") redirect("/");

  const rejected = user.validationStatus === "REJECTED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card as="section" padding="lg" className="w-full max-w-md">
        <p className="mb-2 text-sm font-semibold uppercase text-blue-700">Account validation</p>
        <h1 className="text-xl font-semibold text-gray-950">
          {rejected ? "Account not approved" : "Your account is pending review"}
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          {rejected
            ? "An administrator reviewed this account and did not approve access. Contact the SAT Platform administrator if this is unexpected."
            : "Your account was created successfully, but it was not created through a verified email link. An administrator must validate it before you can access the platform."}
        </p>
        <div className="mt-5 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium">{user.name}</p>
          <p>{user.email}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-500">Status: {user.validationStatus}</p>
        </div>
        <a href="/login" className="mt-5 inline-flex text-sm font-medium text-blue-700 hover:underline">
          Back to login
        </a>
      </Card>
    </main>
  );
}
