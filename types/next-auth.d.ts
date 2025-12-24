import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
    };
  }

  interface User {
    passwordHash?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
  }
}

