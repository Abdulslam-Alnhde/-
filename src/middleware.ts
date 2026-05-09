import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as string | undefined;
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/admin") && role !== "ADMIN") {
      if (role === "COMMITTEE") {
        return NextResponse.redirect(new URL("/committee", req.url));
      }
      return NextResponse.redirect(new URL("/teacher", req.url));
    }

    // Allow ADMIN and COMMITTEE to access /committee
    if (path.startsWith("/committee") && role !== "COMMITTEE" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/teacher", req.url));
    }

    // Allow ADMIN and TEACHER to access /teacher
    if (path.startsWith("/teacher") && role !== "TEACHER" && role !== "ADMIN") {
      if (role === "COMMITTEE") {
        return NextResponse.redirect(new URL("/committee", req.url));
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/teacher",
    "/teacher/:path*",
    "/committee",
    "/committee/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
