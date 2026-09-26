# Classic builder (no BuildKit). The npm ci layer is reused while
# package.json and the lockfile are unchanged.
# The runner is Alpine plus the node binary: no npm, yarn, corepack, or build cache.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build \
  && rm -rf .next/cache \
    .next/standalone/node_modules/sharp \
    .next/standalone/node_modules/@img

FROM alpine:3.24 AS runner
RUN apk add --no-cache libstdc++ ca-certificates \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    DEFAULTS_DIR=/app/defaults \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node config ./defaults
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
