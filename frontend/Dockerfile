# syntax=docker/dockerfile:1.7
# Multi-stage build: pnpm install → vite build → nginx serve.
#
# IMPORTANT: Vite is a static bundler. VITE_* environment variables are
# inlined into the JS bundle at *build time*. Setting them via
# docker-compose `environment:` at runtime has no effect — they MUST be
# passed as build args. See docker-compose.yml `frontend.build.args`.
#
# Note: the generated `src/types/api.ts` is committed to the repo so the
# Docker build doesn't need access to ../contracts/. Re-run `pnpm run
# codegen` locally whenever contracts/openapi.yaml changes.

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---- Build-time environment variables (Vite inlines VITE_* at build) ----
# Defaults below match a local docker-compose dev setup. Override via
# docker-compose's frontend.build.args (which can read from the repo-root .env).

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/ws
ARG VITE_MAP_PROVIDER=osm
ARG VITE_AMAP_KEY=
ARG VITE_AMAP_SECURITY_KEY=
ARG VITE_GITHUB_URL=https://github.com/lucifer-holly/hangzhou-ev-brain

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_MAP_PROVIDER=$VITE_MAP_PROVIDER \
    VITE_AMAP_KEY=$VITE_AMAP_KEY \
    VITE_AMAP_SECURITY_KEY=$VITE_AMAP_SECURITY_KEY \
    VITE_GITHUB_URL=$VITE_GITHUB_URL

RUN pnpm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
