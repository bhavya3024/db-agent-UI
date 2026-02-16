import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default async function middleware(request: NextRequest) {
  const session = await auth();
  
  // If not authenticated and not on login page, redirect to login
  if (!session && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
  // If authenticated and on login page, redirect to home
  if (session && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  // Protect all routes except api/auth and static files
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
