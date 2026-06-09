import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const CONNECTION_ERROR_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);

export function isPrismaConnectionError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    CONNECTION_ERROR_CODES.has(String((err as { code: string }).code))
  );
}

/** Neon 等远程库空闲断连时，重连后再执行一次 */
export async function withPrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isPrismaConnectionError(err)) throw err;
    await prisma.$disconnect();
    await prisma.$connect();
    return fn();
  }
}
