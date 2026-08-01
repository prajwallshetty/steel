import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge route protection.
 *
 * Checks only for the *presence* of a session cookie, then redirects. It is a
 * fast fail for unauthenticated navigation, not the security boundary: the
 * cookie is not verified here, because doing so needs the database and the Edge
 * runtime has no Prisma connection. Real authorisation happens in
 * `modules/auth/guard.ts`, which every page and action goes through.
 */

const PUBLIC_PATHS = ["/login", "/forbidden"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("steel_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the destination so sign-in can return the user to it.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. Those are public
     * by nature and running middleware on them costs latency for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
