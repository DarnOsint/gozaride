# syntax=docker/dockerfile:1

# ---------------- Builder stage ----------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build without a database: the pg pool is lazy so compilation needs no DB.
RUN npm run build

# ---------------- Runner stage ----------------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Only production deps at runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/database ./src/database

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && chown -R nextjs:nodejs /app/.next /app/public
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]