import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

type PrismaClientType = InstanceType<typeof PrismaClient>;

function createPrisma(): PrismaClientType {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  // `timeout` is better-sqlite3's busy_timeout (ms): retry instead of failing
  // with SQLITE_BUSY when the ingest service holds a write lock on the shared
  // dev.db file. WAL + synchronous=NORMAL let readers and the writer coexist;
  // journal_mode is persisted at the DB-file level, so setting it once here
  // covers both the web and ingest processes.
  const adapter = new PrismaBetterSqlite3({ url, timeout: 5000 } as never);
  const client: PrismaClientType = new PrismaClient({ adapter } as never);
  void client
    .$executeRawUnsafe("PRAGMA journal_mode=WAL")
    .then(() => client.$executeRawUnsafe("PRAGMA synchronous=NORMAL"))
    .catch(() => {
      /* pragmas are best-effort; a read-only replica or :memory: may reject them */
    });
  return client;
}

// In production: singleton to avoid exhausting the connection pool.
// In development: always fresh so HMR never serves a stale generated client
// after `prisma generate` (SQLite handles multiple connections fine).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

export const prisma: PrismaClientType =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrisma())
    : createPrisma();

export default prisma;
