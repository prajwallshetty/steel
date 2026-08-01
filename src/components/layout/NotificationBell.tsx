"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format/number";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/notification-actions";
import type { ShellNotification } from "./AppShell";

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  readonly notifications: readonly ShellNotification[];
  readonly unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Click-away layer, so the panel closes without a global listener. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    startTransition(() => {
                      void markAllNotificationsReadAction();
                    })
                  }
                >
                  <CheckCheck />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nothing to show yet.
                </p>
              ) : (
                notifications.map((notification) => {
                  const content = (
                    <>
                      <p className="text-sm font-medium leading-tight">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatTimestamp(notification.createdAt)}
                      </p>
                    </>
                  );

                  const className = cn(
                    "block w-full border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60",
                    !notification.read && "bg-primary/5",
                  );

                  const onSelect = () => {
                    setOpen(false);
                    if (!notification.read) {
                      startTransition(() => {
                        void markNotificationReadAction(notification.id);
                      });
                    }
                  };

                  return notification.link ? (
                    <Link
                      key={notification.id}
                      href={notification.link}
                      className={className}
                      onClick={onSelect}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={notification.id}
                      type="button"
                      className={className}
                      onClick={onSelect}
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
