"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  ScrollText,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { logoutAction } from "@/modules/auth/auth-actions";
import { ROLE_LABELS, type Permission } from "@/modules/permissions/permissions";
import type { Role } from "@prisma/client";

export interface ShellUser {
  readonly name: string;
  readonly role: Role;
  readonly branchName: string | null;
  readonly permissions: readonly string[];
}

export interface ShellNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string;
}

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof LayoutDashboard;
  /** Any one of these grants the item. Omit for "always visible". */
  readonly anyOf?: readonly Permission[];
}

const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/quotations",
    label: "Quotations",
    icon: FileText,
    anyOf: ["quotation:view_all", "quotation:view_branch", "quotation:view_own"],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    anyOf: ["customer:view"],
  },
  {
    href: "/ledger",
    label: "Cash ledger",
    icon: Wallet,
    anyOf: ["ledger:view_all", "ledger:view_branch", "ledger:view_own"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BookOpenCheck,
    anyOf: ["report:view_all", "report:view_branch", "report:view_own"],
  },
];

const ADMIN_NAV: readonly NavItem[] = [
  {
    href: "/admin/branches",
    label: "Branches",
    icon: Building2,
    anyOf: ["branch:view_all", "branch:view"],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    anyOf: ["user:view_all", "user:view"],
  },
  {
    href: "/admin/settings",
    label: "Master settings",
    icon: Settings2,
    anyOf: ["settings:manage"],
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: ScrollText,
    anyOf: ["audit:view"],
  },
];

/**
 * Application chrome.
 *
 * Navigation is filtered by the caller's permissions — but that is presentation
 * only. Every destination re-checks server-side, so hiding a link is a courtesy
 * rather than a control.
 */
export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: {
  readonly user: ShellUser;
  readonly notifications: readonly ShellNotification[];
  readonly unreadCount: number;
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();
  const granted = new Set(user.permissions);

  const visible = (items: readonly NavItem[]) =>
    items.filter(
      (item) => !item.anyOf || item.anyOf.some((permission) => granted.has(permission)),
    );

  const primary = visible(PRIMARY_NAV);
  const admin = visible(ADMIN_NAV);
  const canCreate = granted.has("quotation:create");

  return (
    <div className="flex min-h-screen">
      <aside className="print-hidden sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            ST
          </div>
          <span className="text-sm font-semibold leading-tight">
            Steel ERP
            <span className="block text-xs font-normal text-muted-foreground">
              {user.branchName ?? "All branches"}
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-3">
          <NavGroup items={primary} pathname={pathname} />
          {admin.length > 0 && (
            <NavGroup label="Administration" items={admin} pathname={pathname} />
          )}
        </nav>

        {canCreate && (
          <div className="p-3">
            <Button className="w-full" render={<Link href="/quotations/new" />}>
              <Plus />
              New quotation
            </Button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print-hidden sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-6 backdrop-blur">
          <Link href="/dashboard" className="text-sm font-semibold lg:hidden">
            Steel ERP
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
            />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
                {user.branchName ? ` · ${user.branchName}` : ""}
              </p>
            </div>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  readonly label?: string;
  readonly items: readonly NavItem[];
  readonly pathname: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      {label && (
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      {items.map((item) => {
        // `/quotations` must not light up while on `/quotations/new`'s sibling
        // routes only — prefix matching with a boundary check handles both.
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </div>
  );
}
