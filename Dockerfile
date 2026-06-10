FROM node:24-alpine AS build

ARG PNPM_VERSION=11.5.0

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

LABEL org.opencontainers.image.title="NutriClinica" \
      org.opencontainers.image.description="Plataforma profesional de nutrición clínica" \
      org.opencontainers.image.version="0.1.0"
