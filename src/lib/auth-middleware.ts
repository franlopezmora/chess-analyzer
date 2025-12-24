import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const signInRoute = "/login";

export async function authMiddleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (!token) {
    const signinUrl = new URL(signInRoute, request.url);
    signinUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const auth = authMiddleware;

