import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";

type PrismaClientType = InstanceType<typeof PrismaClient>;

function createPrisma(): PrismaClientType {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  // `timeout` is better-sqlite3's busy_timeout (ms): retry instead of failing
  // with SQLITE_BUSY when the ingest service holds a write lock on the shared
  // dev.db file.
  const adapter = new PrismaBetterSqlite3({ url, timeout: 5000 } as never);
  const client: PrismaClientType = new PrismaClient({ adapter } as never);
  applyPragmas(client);
  return client;
}

/**
 * WAL lets readers and the single writer coexist (journal_mode is persisted in the DB file, so the
 * ingest service gets it too); synchronous=NORMAL is the safe pairing for WAL and is per
 * connection. Set explicitly at startup instead of relying on whatever mode the file was left in.
 */
function applyPragmas(client: PrismaClientType) {
  void (async () => {
    try {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", level: "error", event: "db.pragma_failed", message: String(error) }));
    }
  })();
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
