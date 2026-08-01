"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/guard";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-service";

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser();
  // Scoped by recipient inside the service, so one user cannot dismiss
  // another's notifications by guessing an id.
  await markNotificationRead(id, user.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
