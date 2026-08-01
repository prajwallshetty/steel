"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/admin/settings", label: "Admin settings", icon: Settings2 },
] as const;

/**
 * Desktop ERP chrome: fixed sidebar, sticky top bar, scrollable work area.
 * Marked `print-hidden` so the print stylesheet strips it entirely.
 */
export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="print-hidden sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            ST
          </div>
          <span className="text-sm font-semibold leading-tight">
            Steel Quotation
            <span className="block text-xs font-normal text-muted-foreground">
              Discount / CD
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/quotations"
                ? pathname.startsWith("/quotations")
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3">
          <Button className="w-full" render={<Link href="/quotations/new" />}>
            <Plus />
            New quotation
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print-hidden sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-6 backdrop-blur lg:hidden">
          <Link href="/quotations" className="text-sm font-semibold">
            Steel Quotation
          </Link>
          <Button size="sm" render={<Link href="/quotations/new" />}>
            <Plus />
            New
          </Button>
        </header>

        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
