# Production image for the Next.js web app (Node runtime — required by
# better-sqlite3 + Prisma adapter). Multi-stage: build with dev deps, then run
# `next start`. Migrations are applied at container start against the mounted
# SQLite DB (see deploy/web-entrypoint.sh).

# ---- build ----
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Cap heap so Next/tsc do not SIGSEGV under constrained Docker builders.
ENV NODE_OPTIONS=--max-old-space-size=6144

# NEXT_PUBLIC_* are inlined at build time, so they must be present here.
ARG NEXT_PUBLIC_CALCULATOR_PROVIDER=desmos_sat
ARG NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS=false
ARG NEXT_PUBLIC_CALCULATOR_FULL_TESTS=false
ARG NEXT_PUBLIC_DESMOS_API_KEY=
ARG NEXT_PUBLIC_DESMOS_API_URL=https://www.desmos.com/api/v1.12/calculator.js
ARG NEXT_PUBLIC_DESMOS_SAT_URL=https://www.desmos.com/testing/sat/calculator
ARG NEXT_PUBLIC_GEOGEBRA_URL=https://www.geogebra.org/calculator
ARG NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL=https://www.geogebra.org/apps/deployggb.js
ARG NEXT_PUBLIC_GEOGEBRA_APP_NAME=graphing
ENV NEXT_PUBLIC_CALCULATOR_PROVIDER=$NEXT_PUBLIC_CALCULATOR_PROVIDER \
    NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS=$NEXT_PUBLIC_CALCULATOR_PRACTICE_SETS \
    NEXT_PUBLIC_CALCULATOR_FULL_TESTS=$NEXT_PUBLIC_CALCULATOR_FULL_TESTS \
    NEXT_PUBLIC_DESMOS_API_KEY=$NEXT_PUBLIC_DESMOS_API_KEY \
    NEXT_PUBLIC_DESMOS_API_URL=$NEXT_PUBLIC_DESMOS_API_URL \
    NEXT_PUBLIC_DESMOS_SAT_URL=$NEXT_PUBLIC_DESMOS_SAT_URL \
    NEXT_PUBLIC_GEOGEBRA_URL=$NEXT_PUBLIC_GEOGEBRA_URL \
    NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL=$NEXT_PUBLIC_GEOGEBRA_DEPLOY_URL \
    NEXT_PUBLIC_GEOGEBRA_APP_NAME=$NEXT_PUBLIC_GEOGEBRA_APP_NAME

# Toolchain to compile better-sqlite3's native binding.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---- runner ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# Prisma's engines probe for libssl at startup; node:24-slim ships without it and
# prints an OpenSSL warning on every `migrate deploy`. Install it (small layer).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/app/generated ./app/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY deploy/web-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
