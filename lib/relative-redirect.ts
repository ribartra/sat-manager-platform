import { NextResponse } from "next/server";

/**
 * A redirect to a same-site path with a RELATIVE Location header. Behind the proxy, `req.url`
 * carries the container's host (localhost:3000), so `new URL(path, req.url)` sends the browser
 * there; a relative Location resolves against the public address the browser used.
 */
export function relativeRedirect(path: string, status = 307) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`relativeRedirect: not a same-site path: ${path}`);
  return new NextResponse(null, { status, headers: { Location: path } });
}
