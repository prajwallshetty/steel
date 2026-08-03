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
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/10 px-4 py-12 overflow-hidden">
      {/* Dynamic background glow spheres */}
      <div className="absolute -left-12 -top-12 size-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -right-12 -bottom-12 size-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-sm space-y-8 z-10">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/25 select-none animate-fade-in">
            ST
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground select-none">
            Steel Quotation ERP
          </h1>
          <p className="text-sm text-muted-foreground select-none">
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
