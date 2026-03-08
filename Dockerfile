# ── Stage 1: Install dependencies ────────────────────────────────────────────
# better-sqlite3 is a native Node addon — needs build tools to compile.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── Stage 2: Build the Next.js app ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl is used to auto-generate NEXTAUTH_SECRET when not provided
RUN apk add --no-cache openssl

COPY --from=builder /app/public       ./public
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts      ./scripts

EXPOSE 3000

# Auto-generate NEXTAUTH_SECRET if the caller didn't supply one.
# This removes the need for non-devs to understand openssl.
CMD ["sh", "-c", "export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(openssl rand -base64 32)} && npm start"]
