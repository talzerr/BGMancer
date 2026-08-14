FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# src/lib/env.ts throws on an empty NEXTAUTH_SECRET and Next evaluates server
# modules during the build. This placeholder never reaches the runtime stage.
ENV NEXTAUTH_SECRET=build-time-placeholder-not-used-at-runtime
RUN pnpm build

# Migration runner. The standalone runtime below prunes devDependencies and the
# drizzle/ folder, so it cannot apply migrations — this stage keeps drizzle-kit
# and the migration journal and is deployed as a separate k8s Job.
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/lib/db/drizzle-schema.ts ./src/lib/db/drizzle-schema.ts
CMD ["pnpm","exec","drizzle-kit","migrate"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
