"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Settings2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { logoutAction } from "@/modules/auth/auth-actions";
import { PWAInstallButton } from "./PWAInstallButton";
import { PWAInstallBanner } from "./PWAInstallBanner";
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
    label: "Add Customer",
    icon: Users,
    anyOf: ["customer:view"],
  },
  {
    href: "/vendors",
    label: "Add Vendor",
    icon: Users,
    anyOf: ["customer:view"],
  },
  {
    href: "/customer-payments",
    label: "Customer Payment",
    icon: Wallet,
    anyOf: ["ledger:view_all", "ledger:view_branch", "ledger:view_own"],
  },
  {
    href: "/vendor-payments",
    label: "Vendor Payment",
    icon: Wallet,
    anyOf: ["ledger:view_all", "ledger:view_branch", "ledger:view_own"],
  },
  {
    href: "/ledger",
    label: "Ledger",
    icon: BookOpenCheck,
    anyOf: ["ledger:view_all", "ledger:view_branch", "ledger:view_own"],
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const granted = new Set(user.permissions);

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const visible = (items: readonly NavItem[]) =>
    items.filter(
      (item) => !item.anyOf || item.anyOf.some((permission) => granted.has(permission)),
    );

  const primary = visible(PRIMARY_NAV);
  const admin = visible(ADMIN_NAV);
  const canCreate = granted.has("quotation:create");

  return (
    <div className="flex min-h-screen bg-background">
      <NavigationProgress />

      {/* Desktop Sidebar */}
      <aside className="print-hidden sticky top-0 hidden h-screen w-68 shrink-0 flex-col border-r bg-card lg:flex transition-all duration-300">
        <div className="flex h-20 items-center border-b px-6 gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10 select-none">
            LSC
          </div>
          <span className="text-[17px] font-extrabold leading-tight text-foreground tracking-tight">
            LSC Alloys ERP
            <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
              {user.branchName ?? "All branches"}
            </span>
          </span>
        </div>

        <nav className="flex-1 space-y-8 overflow-y-auto p-4">
          <MemoizedNavGroup items={primary} pathname={pathname} />
          {admin.length > 0 && (
            <MemoizedNavGroup label="Administration" items={admin} pathname={pathname} />
          )}
          <div className="pt-4 border-t border-border/40">
            <PWAInstallButton />
          </div>
        </nav>

        {canCreate && (
          <div className="p-4 border-t border-border/40">
            <Button className="w-full h-12 text-[16px] font-bold rounded-lg transition-transform active:scale-[0.98]" render={<Link href="/quotations/new" />}>
              <Plus className="size-5" />
              New quotation
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Overlay & Panel */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden animate-in fade-in"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "print-hidden fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r bg-card shadow-2xl transition-transform duration-300 ease-in-out lg:hidden pt-safe pb-safe",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10 select-none">
              LSC
            </div>
            <span className="text-[17px] font-extrabold leading-tight text-foreground tracking-tight">
              LSC Alloys ERP
              <span className="block text-[11px] font-medium text-muted-foreground mt-0.5">
                {user.branchName ?? "All branches"}
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
            className="size-9 rounded-lg"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
          <MemoizedNavGroup items={primary} pathname={pathname} />
          {admin.length > 0 && (
            <MemoizedNavGroup label="Administration" items={admin} pathname={pathname} />
          )}
          <div className="pt-4 border-t border-border/40">
            <PWAInstallButton />
          </div>
        </nav>

        {canCreate && (
          <div className="p-4 border-t border-border/40">
            <Button
              className="w-full h-12 text-[16px] font-bold rounded-lg transition-transform active:scale-[0.98]"
              onClick={() => setIsMobileOpen(false)}
              render={<Link href="/quotations/new" />}
            >
              <Plus className="size-5" />
              New quotation
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <PWAInstallBanner />
        <header className="print-hidden sticky top-0 z-20 flex h-16 sm:h-20 items-center justify-between gap-3 border-b bg-background/95 px-4 sm:px-8 backdrop-blur pt-safe">
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation menu"
              className="size-10 rounded-lg text-foreground hover:bg-accent"
            >
              <Menu className="size-6" />
            </Button>
            <Link href="/dashboard" className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                LSC
              </span>
              <span className="hidden xs:inline">LSC Alloys ERP</span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
            />

            <div className="hidden text-right sm:block">
              <p className="text-[15px] sm:text-[16px] font-bold leading-tight text-foreground">{user.name}</p>
              <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5">
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
                className="size-10 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
              >
                <LogOut className="size-5" />
              </Button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 bg-background pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavGroupComponent({
  label,
  items,
  pathname,
}: {
  readonly label?: string;
  readonly items: readonly NavItem[];
  readonly pathname: string;
}) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {label && (
        <p className="px-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 select-none">
          {label}
        </p>
      )}
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onMouseEnter={() => {
              router.prefetch(item.href);
            }}
            onFocus={() => {
              router.prefetch(item.href);
            }}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-4 py-3 text-[16px] md:text-[17px] font-semibold transition-all duration-150 group select-none gpu-accelerated active:scale-[0.98]",
              active
                ? "bg-primary/8 text-primary shadow-xs"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-md bg-primary" />
            )}
            <item.icon className={cn("size-5 shrink-0 transition-transform duration-150 group-hover:scale-105", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

const MemoizedNavGroup = memo(NavGroupComponent);

