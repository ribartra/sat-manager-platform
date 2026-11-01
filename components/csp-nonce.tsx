"use client";

import { setNonce } from "get-nonce";

/**
 * Hands the per-request CSP nonce (proxy.ts → x-nonce) to libraries that inject <style> tags at
 * runtime through `get-nonce` (react-remove-scroll, used by every Radix dialog/menu). Rendered
 * first in <body>, so the nonce is set before any child mounts.
 */
export function CspNonce({ nonce }: { nonce: string | undefined }) {
  if (nonce) setNonce(nonce);
  return null;
}
