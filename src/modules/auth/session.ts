import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { ScopeSubject } from "@/modules/permissions/scope";

/**
 * Session handling.
 *
 * A signed JWT in an httpOnly cookie carries the session id; the authoritative
 * user record is then loaded from the database on every request. The token is
 * a pointer, not a claim store — so disabling a user, changing their role or
 * revoking a session takes effect on their very next request rather than
 * whenever a stale token happens to expire.
 */

const COOKIE_NAME = "steel_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters.",
    );
  }
  return new TextEncoder().encode(value);
}

export interface SessionUser extends ScopeSubject {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly email: string | null;
  readonly role: Role;
  readonly branchId: string | null;
  readonly branchName: string | null;
  readonly branchCode: string | null;
  readonly extraPermissions: readonly string[];
  readonly deniedPermissions: readonly string[];
  readonly sessionId: string;
}

/** Create a database session row and set the cookie. */
export async function createSession(userId: string): Promise<void> {
  const requestHeaders = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      ipAddress: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 512) ?? null,
    },
  });

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Revoke the current session and clear the cookie. */
export async function destroySession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (!token) return null;

  const sessionId = await readSessionId(token);
  if (sessionId) {
    await prisma.session
      .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
      .catch(() => undefined); // Already gone — logging out is still a success.
  }
  return sessionId;
}

/**
 * The current user, or null when signed out.
 *
 * Not cached across requests: the whole point of the database round trip is to
 * observe revocations immediately.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const sessionId = await readSessionId(token);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: { branch: true } } },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() < Date.now() ||
    session.user.deletedAt !== null ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    return null;
  }

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branchName: user.branch?.name ?? null,
    branchCode: user.branch?.code ?? null,
    extraPermissions: user.extraPermissions,
    deniedPermissions: user.deniedPermissions,
    sessionId: session.id,
  };
}

async function readSessionId(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    // Tampered, expired or signed with a rotated secret — all mean "no session".
    return null;
  }
}

/** Revoke every session for a user. Used on disable and password reset. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function clientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return requestHeaders.get("x-real-ip");
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
