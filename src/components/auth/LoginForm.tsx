"use client";

import { useActionState, useEffect, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      // A full refresh so the shell re-renders with the new session.
      router.replace(nextPath);
      router.refresh();
    }
  }, [state, nextPath, router]);

  const handleQuickLogin = (username: string) => {
    if (formRef.current) {
      const usernameInput = formRef.current.elements.namedItem("username") as HTMLInputElement;
      const passwordInput = formRef.current.elements.namedItem("password") as HTMLInputElement;
      if (usernameInput && passwordInput) {
        usernameInput.value = username;
        passwordInput.value = "ChangeMe123";
        formRef.current.requestSubmit();
      }
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} action={formAction} className="space-y-4">
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-card px-2 text-muted-foreground font-medium select-none">
              Demo Accounts
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-2 flex flex-col items-center justify-center h-12 gap-0 border-dashed border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 shadow-none hover:shadow-sm"
            onClick={() => handleQuickLogin("superadmin")}
            disabled={pending}
          >
            <span className="text-[11px] font-semibold text-primary">Super Admin</span>
            <span className="text-[9px] text-muted-foreground font-normal">Global Control</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 gap-0 border-dashed border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300 shadow-none hover:shadow-sm"
            onClick={() => handleQuickLogin("mangalore.admin")}
            disabled={pending}
          >
            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">MNG Admin</span>
            <span className="text-[9px] text-muted-foreground font-normal">Branch Admin</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 gap-0 border-dashed border-teal-500/20 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all duration-300 shadow-none hover:shadow-sm"
            onClick={() => handleQuickLogin("mangalore.manager1")}
            disabled={pending}
          >
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">MNG Manager</span>
            <span className="text-[9px] text-muted-foreground font-normal">Sales Agent</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 gap-0 border-dashed border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all duration-300 shadow-none hover:shadow-sm"
            onClick={() => handleQuickLogin("maharashtra.admin")}
            disabled={pending}
          >
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">MAH Admin</span>
            <span className="text-[9px] text-muted-foreground font-normal">Branch Admin</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex flex-col items-center justify-center h-12 gap-0 border-dashed border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-300 shadow-none hover:shadow-sm"
            onClick={() => handleQuickLogin("maharashtra.manager1")}
            disabled={pending}
          >
            <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">MAH Manager</span>
            <span className="text-[9px] text-muted-foreground font-normal">Sales Agent</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
