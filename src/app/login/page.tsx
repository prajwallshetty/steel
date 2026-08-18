import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/modules/auth/session";
import { LoginDisguise } from "@/components/auth/LoginDisguise";

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

  return <LoginDisguise nextPath={sanitiseNext(next)} />;
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
