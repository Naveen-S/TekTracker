# StoryBoard — production image (Next.js 16 standalone).
#
# Node 22 is REQUIRED (.nvmrc = 22, package.json engines >=22.12, Prisma 7). Do not
# downgrade to node:20 — install/build will fail.
#
# The build is env-free (no NEXT_PUBLIC_* vars; DATABASE_URL is not read at build time),
# so no secrets are needed to `docker build`. Runtime secrets are BAKED into the image via
# a real `.env` (deployment decision). Because `.env` is gitignored, the CI job (Jenkins)
# MUST materialize the real `.env` into the build context before `docker build`.
#
# Database migrations are NOT run here — run `yarn db:deploy` (prisma migrate deploy) as a
# separate release step against the internal Postgres (see DEPLOY.md).

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Tekion JFrog npm proxy (matches the org's other services).
RUN yarn config set registry https://jfrog-proxy.tekioncloud.xyz/artifactory/api/npm/rpe-virtual-npm/

# Install deps first for layer caching. `prisma/` is copied before install because the
# `postinstall` script runs `prisma generate`, which needs prisma/schema.prisma present.
COPY package.json yarn.lock ./
COPY prisma ./prisma
RUN yarn install --frozen-lockfile

# Copy the rest and build. `next build` (with output: "standalone") produces
# `.next/standalone` (server + traced deps) and `.next/static`.
COPY . .
RUN yarn build

# ---------- Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Next.js standalone server reads PORT/HOSTNAME. 0.0.0.0 so it binds inside the container.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Self-contained server + traced node_modules (incl. the generated Prisma client).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Runtime secrets, baked in (deployment decision). Requires the real .env to be present in
# the build context — see the header note. `next` loads .env at server start.
COPY --from=builder /app/.env* ./

EXPOSE 3000
CMD ["node", "server.js"]
