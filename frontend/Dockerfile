# syntax=docker/dockerfile:1.7
# Multi-stage build: pnpm install → vite build → nginx serve.
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
RUN pnpm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
