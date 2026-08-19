import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/modules/auth/guard";
import { ForbiddenError } from "@/modules/permissions/scope";

/**
 * The uniform result shape every server action returns.
 *
 * Actions never throw across the network boundary: an uncaught error in a
 * server action reaches the client as an opaque digest with no message, which
 * is useless to the user and hides the cause. Failures are converted here into
 * something renderable, while genuinely unexpected errors are logged server-
 * side and reported generically rather than leaking internals.
 */
export type ActionResult<T = { readonly id: string }> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: string;
      /** Present for validation failures, keyed by form field path. */
      readonly fieldErrors?: Readonly<Record<string, string>>;
    };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const actionError = (
  error: string,
  fieldErrors?: Readonly<Record<string, string>>,
): ActionResult<never> => ({ ok: false, error, fieldErrors });

/** Domain error for rule violations that are the user's to fix. */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

/** Domain error for a missing or out-of-scope record. */
export class RecordNotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} was not found.`);
    this.name = "RecordNotFoundError";
  }
}

/**
 * Wrap a server action body so every failure mode becomes an `ActionResult`.
 */
export async function runAction<T>(
  body: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    return toActionError(error);
  }
}

export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return actionError(
      error.issues[0]?.message ?? "Please check the highlighted fields.",
      fieldErrors,
    );
  }

  if (error instanceof UnauthorizedError) {
    return actionError("Your session has expired. Please sign in again.");
  }

  if (
    error instanceof ForbiddenError ||
    error instanceof BusinessRuleError ||
    error instanceof RecordNotFoundError
  ) {
    return actionError(error.message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 is a unique-constraint violation; the target names the column, which
    // is far more actionable than "something went wrong".
    if (error.code === "P2002") {
      const rawTarget = error.meta?.target;
      let fieldName = "name";
      if (Array.isArray(rawTarget)) {
        const filtered = (rawTarget as string[]).filter((t) => t !== "branchId");
        fieldName = filtered.map(humanise).join(", ") || "name";
      } else if (typeof rawTarget === "string") {
        if (rawTarget.includes("name")) fieldName = "name";
        else if (rawTarget.includes("gstNumber")) fieldName = "GSTIN";
        else if (rawTarget.includes("phone")) fieldName = "phone number";
        else if (rawTarget.includes("email")) fieldName = "email address";
        else if (rawTarget.includes("username")) fieldName = "username";
        else if (rawTarget.includes("code")) fieldName = "code";
      }
      return actionError(`A record with this ${fieldName} already exists.`);
    }
    if (error.code === "P2003") {
      return actionError(
        "That record is still referenced elsewhere and cannot be changed.",
      );
    }
    if (error.code === "P2025") {
      return actionError("That record no longer exists.");
    }
  }

  // Anything unrecognised is a bug. Log it with the stack for the server
  // operator; tell the user only that it failed.
  console.error("[action] unhandled error", error);
  return actionError("Something went wrong. Please try again.");
}

const humanise = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
