/**
 * Runs once when the server starts. The Node-only work lives in instrumentation-node.ts (imported only
 * for the Node runtime, so SQLite never reaches the edge bundle).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
