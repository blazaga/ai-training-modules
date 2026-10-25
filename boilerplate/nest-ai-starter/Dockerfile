# syntax=docker/dockerfile:1
# Multi-stage: build with dev dependencies, run with production dependencies only.

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml carries frozenLockfile, allowBuilds and the release-age policy (pnpm 12).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Migrations: `node dist/database/migrate.js` (pnpm db:migrate) applies these.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
# Liveness via the app's own endpoint. Uses Node's fetch, so no curl in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
