import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definido. Configuralo en tu entorno.");
}

declare global {
  var prisma: PrismaClient | undefined;
  var prismaAdapter: PrismaPg | undefined;
}

const adapter =
  globalThis.prismaAdapter ??
  new PrismaPg({
    connectionString,
    ssl:
      connectionString.includes("neon.tech") || connectionString.includes("supabase.co")
        ? { rejectUnauthorized: false }
        : undefined,
  });

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
  globalThis.prismaAdapter = adapter;
}

