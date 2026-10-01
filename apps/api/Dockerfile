FROM node:24.13.0-bookworm-slim AS build

ARG PNPM_VERSION=11.5.0

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY deployment/scripts/prepare.mjs deployment/scripts/prepare.mjs

RUN pnpm install --frozen-lockfile --filter @nutriclinica/api...

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @nutriclinica/api typecheck \
    && pnpm --filter @nutriclinica/api build:deploy \
    && pnpm --config.inject-workspace-packages=true --filter @nutriclinica/api deploy --prod /opt/nutriclinica-api

FROM node:24.13.0-bookworm-slim AS runtime

ARG RELEASE_VERSION=0.0.0-local
ARG RELEASE_COMMIT=UNKNOWN

ENV NODE_ENV=production \
    API_BIND_HOST=0.0.0.0 \
    PORT=3000 \
    RELEASE_VERSION=${RELEASE_VERSION} \
    DESKTOP_RELEASE_VERSION=${RELEASE_VERSION} \
    GIT_COMMIT=${RELEASE_COMMIT} \
    NUTRICLINICA_REPO_ROOT=/app \
    NUTRICLINICA_MIGRATIONS_DIR=/app/apps/api/migrations \
    NUTRICLINICA_DWH_SCHEMA_FILE=/app/apps/api/dist-deploy/dwh-schema.sql

WORKDIR /app/apps/api

COPY --chown=node:node --from=build /opt/nutriclinica-api/package.json ./package.json
COPY --chown=node:node --from=build /opt/nutriclinica-api/node_modules ./node_modules
COPY --chown=node:node --from=build /opt/nutriclinica-api/dist-deploy ./dist-deploy
COPY --chown=node:node --from=build /opt/nutriclinica-api/migrations ./migrations
COPY --chown=node:node package.json /app/package.json
COPY --chown=node:node src-tauri/tauri.conf.json /app/src-tauri/tauri.conf.json
COPY --chown=node:node src-tauri/Cargo.lock /app/src-tauri/Cargo.lock

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "dist-deploy/healthcheck.js"]

LABEL org.opencontainers.image.title="NutriClinica API" \
      org.opencontainers.image.description="Backend compartido para Desktop Tauri y Web" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.revision="${RELEASE_COMMIT}" \
      org.opencontainers.image.source="NutriClinica"

CMD ["node", "dist-deploy/server.js"]
