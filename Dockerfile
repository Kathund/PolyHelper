FROM node:24.22.1-alpine3.24

ENV NODE_ENV=production
ENV RUNNING_IN_DOCKER=true

ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_DIRTY=false

ARG NODE_DISABLE_COMPILE_CACHE=1
ARG npm_config_nodedir=/usr/local

WORKDIR /app

RUN apk add --no-cache \
        python3 \
    && chown node:node /app \
    && npm install -g --cache /tmp/npm-cache pnpm@11.21.0 \
    && rm -rf /tmp/npm-cache

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN apk add --no-cache --virtual .build-deps \
        build-base \
    && pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store --cache-dir /tmp/pnpm-cache \
    && rm -rf /tmp/pnpm-store /tmp/pnpm-cache \
    && chown -R node:node node_modules \
    && apk del --no-cache .build-deps

COPY --chown=node:node . .
USER node
RUN pnpm build

ENTRYPOINT ["pnpm", "start"]
