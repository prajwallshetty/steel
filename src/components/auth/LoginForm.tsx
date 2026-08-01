"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { loginAction } from "@/modules/auth/auth-actions";

export function LoginForm({ nextPath }: { readonly nextPath: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, null);

  useEffect(() => {
    if (state?.ok) {
      // A full refresh so the shell re-renders with the new session.
      router.replace(nextPath);
      router.refresh();
    }
  }, [state, nextPath, router]);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          {state && !state.ok && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              required
              placeholder="superadmin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
