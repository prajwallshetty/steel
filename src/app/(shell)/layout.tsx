import { requireUser } from "@/modules/auth/guard";
import { effectivePermissions } from "@/modules/permissions/permissions";
import {
  countUnread,
  listNotifications,
} from "@/modules/notifications/notification-service";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

/**
 * Chrome for every authenticated screen except the print view.
 *
 * Resolving the session here means an unauthenticated request never renders a
 * child page at all — the guard redirects before any data is fetched.
 */
export default async function ShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id, 20),
    countUnread(user.id),
  ]);

  return (
    <AppShell
      user={{
        name: user.name,
        role: user.role,
        branchName: user.branchName,
        permissions: [...effectivePermissions(user)],
      }}
      unreadCount={unreadCount}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        read: notification.readAt !== null,
        createdAt: notification.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
