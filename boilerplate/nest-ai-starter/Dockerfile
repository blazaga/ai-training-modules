# syntax=docker/dockerfile:1
# Stages:
#   base     dependencies installed (all of them), as the unprivileged `node` user
#   dev      base + source: the toolbox for `docker compose run --rm dev pnpm …`
#   build    base + source, compiled, pruned to production dependencies
#   runtime  the production image (the default target: `docker build .`)

FROM node:24-bookworm-slim AS base
# corepack provides the pnpm version pinned in package.json (packageManager).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && mkdir -p /app && chown node:node /app
WORKDIR /app
USER node
# pnpm-workspace.yaml carries frozenLockfile, allowBuilds and the release-age policy (pnpm 12).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS dev
COPY --chown=node:node . .
CMD ["pnpm", "verify"]

FROM base AS build
COPY --chown=node:node . .
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Migrations: `node dist/database/migrate.js` (the compose `migrate` service) applies these.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
# Liveness via the app's own endpoint. Uses Node's fetch, so no curl in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
