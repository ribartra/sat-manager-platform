import { getPublicCalculatorConfig } from "@/lib/calculator-config";

/**
 * sonner injects one constant <style> element at runtime and offers no nonce option, so it is
 * allowed by hash. next.config.ts computes the hash from node_modules/sonner at build time
 * (SONNER_STYLE_HASH); `npm run qa:ui` checks it still matches the installed sonner.
 */
const SONNER_STYLE_HASH = process.env.SONNER_STYLE_HASH ?? "";
/**
 * sonner appends its <style> element empty and fills it right after; the browser checks the CSP
 * at both moments, so the empty content's hash (sha256 of "") must be allowed too. An empty
 * stylesheet carries nothing.
 */
const EMPTY_STYLE_HASH = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

function originOf(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Origins the embedded calculators (iframe or JS API) need. */
function calculatorOrigins() {
  const cfg = getPublicCalculatorConfig();
  const origins = new Set<string>();
  for (const url of [cfg.desmosApiUrl, cfg.desmosSatUrl, cfg.geogebraUrl, cfg.geogebraDeployUrl]) {
    const origin = originOf(url);
    if (origin) origins.add(origin);
  }
  return [...origins].join(" ");
}

export function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Per-request Content-Security-Policy. Scripts and <style> elements need the request nonce
 * (no 'unsafe-inline'); 'strict-dynamic' lets Next's nonce'd runtime load its chunks and the
 * Desmos/GeoGebra API scripts. Only style *attributes* stay inline-allowed: KaTeX, Radix
 * positioning and chart widths set style="…", which cannot carry a nonce and runs no code.
 */
export function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const calc = calculatorOrigins();
  const sonner = SONNER_STYLE_HASH ? ` 'sha256-${SONNER_STYLE_HASH}' 'sha256-${EMPTY_STYLE_HASH}'` : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    // Report preview iframe loads the same-origin PDF endpoint; calculators embed by iframe.
    `frame-src 'self' ${calc}`,
    `img-src 'self' data: blob: ${calc}`,
    `font-src 'self' data: ${calc}`,
    // Dev: webpack/HMR injects <style> tags without a nonce.
    dev ? "style-src-elem 'self' 'unsafe-inline'" : `style-src-elem 'self' 'nonce-${nonce}'${sonner}`,
    "style-src-attr 'unsafe-inline'",
    // 'unsafe-eval' is only needed by the dev server (HMR/React refresh).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self' ${calc}`,
    "worker-src 'self' blob:",
    "form-action 'self'",
  ].join("; ");
}
