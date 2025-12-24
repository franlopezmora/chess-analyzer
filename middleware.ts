export { auth as middleware } from "./src/lib/auth-middleware";

export const config = {
  matcher: ["/dashboard/:path*"],
};

