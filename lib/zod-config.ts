import { z } from "zod";

// Zod 4 probes `new Function` when it builds an object schema, to JIT-compile parsers. The page
// CSP forbids eval, so the probe only produces a CSP violation before falling back; skip it.
// Contracts import `z` from here (not from "zod") so this runs before any schema is created.
z.config({ jitless: true });

export { z };
