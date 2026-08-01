import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          Your role does not have permission to view this page. If you think
          this is a mistake, ask your administrator to review your access.
        </p>
        <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
      </div>
    </div>
  );
}
