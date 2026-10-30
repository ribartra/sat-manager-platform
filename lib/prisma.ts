import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";
import { isRetryableSqliteError, SQLITE_BUSY_TIMEOUT_MS, sqliteRetryDelay, SQLITE_RETRY_ATTEMPTS } from "@/lib/sqlite-retry";

type PrismaClientType = InstanceType<typeof PrismaClient>;

/**
 * The connection is configured when it opens, before the first query runs: WAL lets readers and the
 * single writer coexist (journal_mode is persisted in the file, so the ingest service gets it too);
 * synchronous=NORMAL is the safe pairing for WAL and is per connection; busy_timeout is how long one
 * statement waits for the write lock. better-sqlite3 waits synchronously (the event loop is blocked
 * meanwhile), so the wait is short and longer contention is handled by async retries (below).
 */
class ConfiguredSqliteAdapter extends PrismaBetterSqlite3 {
  async connect() {
    const adapter = await super.connect();
    await adapter.executeScript(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};`);
    return adapter;
  }
}

/**
 * Transaction gate. The adapter runs every request on ONE SQLite connection, so while a transaction is
 * open (BEGIN … COMMIT across awaits) any other request's statement would run INSIDE it — and be rolled
 * back with it. Transactions are therefore exclusive: one at a time, started only when no other
 * statement is in flight, and other statements wait until it ends. Statements issued by the
 * transaction itself (its async scope) pass straight through.
 */
const inTransaction = new AsyncLocalStorage<true>();
let inFlight = 0;
let drained: (() => void) | null = null;
let exclusive: Promise<void> | null = null;
let transactionQueue: Promise<void> = Promise.resolve();

async function runShared<T>(operation: () => Promise<T>): Promise<T> {
  if (inTransaction.getStore()) return operation();
  while (exclusive) await exclusive;
  inFlight += 1;
  try {
    return await operation();
  } finally {
    inFlight -= 1;
    if (inFlight === 0 && drained) drained();
  }
}

async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  if (inTransaction.getStore()) return operation();
  const previous = transactionQueue;
  let release!: () => void;
  transactionQueue = new Promise<void>((resolve) => (release = resolve));
  await previous;
  let open!: () => void;
  exclusive = new Promise<void>((resolve) => (open = resolve));
  try {
    if (inFlight > 0) await new Promise<void>((resolve) => (drained = resolve));
    drained = null;
    return await inTransaction.run(true, operation);
  } finally {
    exclusive = null;
    open();
    release();
  }
}

function createPrisma(): PrismaClientType {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new ConfiguredSqliteAdapter({ url, timeout: SQLITE_BUSY_TIMEOUT_MS } as never);
  const base = new PrismaClient({ adapter } as never);
  // Every operation (models and raw SQL, any role) retries when the write lock stays busy: a failed
  // statement wrote nothing, so running it again is safe. The wait between tries is async, so other
  // requests keep being served.
  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        return runShared(async () => {
          for (let attempt = 1; ; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              if (!isRetryableSqliteError(error) || attempt >= SQLITE_RETRY_ATTEMPTS) throw error;
              await new Promise((resolve) => setTimeout(resolve, sqliteRetryDelay(attempt)));
            }
          }
        });
      },
    },
  });
  const transaction = extended.$transaction.bind(extended) as (...args: unknown[]) => Promise<unknown>;
  // $transaction (interactive or batched) goes through the gate above.
  return new Proxy(extended, {
    get(target, property, receiver) {
      if (property === "$transaction") return (...args: unknown[]) => runExclusive(() => transaction(...args));
      return Reflect.get(target, property, receiver);
    },
  }) as unknown as PrismaClientType;
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
