import type { Metadata } from "next";
import Link from "next/link";
import { Wrench, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Site Maintenance" };

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-xl shadow-amber-500/10 border border-amber-500/20">
          <Wrench className="size-10 animate-bounce" />
        </div>

        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
            System Under Maintenance
          </span>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
            ERP
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            The ERP system is currently undergoing scheduled system updates and financial maintenance. Access for standard user accounts is temporarily paused.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border text-left space-y-2.5 text-xs text-muted-foreground shadow-xs">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            Super Admin Override Active
          </div>
          <p>
            Super Admin accounts retain full access during maintenance. If you are an administrator, you can log in below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button variant="outline" className="w-full sm:w-auto gap-2" render={<Link href="/login" />}>
            Super Admin Login
          </Button>
          <Button className="w-full sm:w-auto gap-2" render={<Link href="/maintenance" />}>
            <RefreshCw className="size-4" />
            Check Status
          </Button>
        </div>
      </div>
    </div>
  );
}
