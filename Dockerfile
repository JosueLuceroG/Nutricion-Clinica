FROM node:24.13.0-alpine AS build

ARG PNPM_VERSION=11.5.0
ARG VITE_API_URL=/api
ARG RELEASE_VERSION=0.0.0-local
ARG RELEASE_COMMIT=UNKNOWN

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY deployment/scripts/prepare.mjs deployment/scripts/prepare.mjs
RUN pnpm install --frozen-lockfile

COPY . .
RUN test -n "${VITE_API_URL}" && CI=true VITE_API_URL="${VITE_API_URL}" VITE_RELEASE_VERSION="${RELEASE_VERSION}" pnpm build

FROM nginx:1.28.0-alpine AS runtime

ARG RELEASE_VERSION=0.0.0-local
ARG RELEASE_COMMIT=UNKNOWN

RUN rm -f /etc/nginx/conf.d/default.conf \
    && mkdir -p /etc/nginx/snippets \
    && chown -R nginx:nginx /etc/nginx/conf.d /etc/nginx/snippets /var/cache/nginx /var/run

COPY --chown=nginx:nginx nginx.conf /etc/nginx/templates/default.conf.template
COPY --chown=nginx:nginx nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf

COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html

ENV API_UPSTREAM=http://api:3000

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

LABEL org.opencontainers.image.title="NutriClinica Web" \
      org.opencontainers.image.description="Cliente Web secundario de NutriClinica" \
      org.opencontainers.image.version="${RELEASE_VERSION}" \
      org.opencontainers.image.revision="${RELEASE_COMMIT}" \
      org.opencontainers.image.source="NutriClinica"
