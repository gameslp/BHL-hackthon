# syntax=docker/dockerfile:1.6

FROM node:22-slim AS base

ARG NEXT_PUBLIC_API_URL="http://localhost:3030/api"

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates build-essential python3 git openssl \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY spec ./spec

FROM base AS builder

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/database run generate
RUN pnpm --filter @repo/frontend run generate:client
RUN pnpm run build

FROM node:22-slim AS backend

ARG NEXT_PUBLIC_API_URL="http://localhost:3030/api"

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

COPY --from=builder /app /app
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

CMD ["/entrypoint.sh"]

FROM node:22-slim AS frontend

ARG NEXT_PUBLIC_API_URL="http://localhost:3030/api"

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN corepack enable \
  && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3001

CMD ["pnpm", "--filter", "@repo/frontend", "run", "start"]
