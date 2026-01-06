/**
 * Middleware for route protection.
 */

import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login", "/reset-password"];
const authRoutes = ["/login", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Get refresh token from cookies or check for auth header
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // If trying to access auth routes while authenticated, redirect to dashboard
  if (isAuthRoute && refreshToken) {
    return NextResponse.redirect(new URL("/clientes", request.url));
  }

  // If trying to access protected route without authentication, redirect to login
  if (!isPublicRoute && !refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};
