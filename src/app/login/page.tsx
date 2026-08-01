import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            ST
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Steel Quotation ERP
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to your dashboard.
          </p>
        </div>

        <LoginForm nextPath={sanitiseNext(next)} />
      </div>
    </div>
  );
}

/**
 * Only same-origin relative paths are honoured.
 *
 * Redirecting to an arbitrary `next` value is an open-redirect: an attacker
 * could send `/login?next=https://evil.example` and bounce a freshly
 * authenticated user off-site.
 */
function sanitiseNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
