import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/modules/permissions/permissions";
import { ForbiddenError } from "@/modules/permissions/scope";

/**
 * Server-side authorisation guards.
 *
 * Every page, server action and route handler enters through one of these.
 * Nothing anywhere reads a role from the client: the session is loaded from the
 * database and checked here, so a forged form field or a patched bundle changes
 * nothing about what the server will do.
 */

/** Thrown when a request arrives without a valid session. */
export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** The signed-in user, or a redirect to the login screen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * The signed-in user, asserted to hold a permission.
 *
 * Page-level failures redirect to a forbidden screen rather than throwing,
 * because a thrown error in a server component renders as a generic 500 and
 * tells the user nothing useful.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/forbidden");
  return user;
}

/** As {@link requirePermission}, but any one of the listed permissions suffices. */
export async function requireAnyPermission(
  permissions: readonly Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasAnyPermission(user, permissions)) redirect("/forbidden");
  return user;
}

/**
 * Action-flavoured guards.
 *
 * Server actions return a result object rather than redirecting, so the client
 * can surface the reason inline. These throw typed errors that
 * `withActionGuard` converts into that shape.
 */
export async function authorizeAction(
  permission: Permission,
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError("You do not have permission to do that.");
  }
  return user;
}

export async function authorizeActionAny(
  permissions: readonly Permission[],
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  if (!hasAnyPermission(user, permissions)) {
    throw new ForbiddenError("You do not have permission to do that.");
  }
  return user;
}
