# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20-bullseye
ARG THIRDWEB_CLIENT_ID=""
ARG VITE_GATEWAY_BASE=""
ARG SWAP_API_BASE=""
ARG BUILD_MINIAPP="true"

FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/gateway/package*.json apps/gateway/
COPY apps/miniapp/package*.json apps/miniapp/

RUN npm install --prefix apps/gateway \
 && npm install --prefix apps/miniapp

FROM deps AS build-miniapp
ARG BUILD_MINIAPP
ARG THIRDWEB_CLIENT_ID
ARG VITE_GATEWAY_BASE
ARG SWAP_API_BASE
ENV THIRDWEB_CLIENT_ID=${THIRDWEB_CLIENT_ID}
ENV VITE_THIRDWEB_CLIENT_ID=${THIRDWEB_CLIENT_ID}
ENV VITE_GATEWAY_BASE=${VITE_GATEWAY_BASE}
ENV SWAP_API_BASE=${SWAP_API_BASE}

ENV PRIVKEY=${PRIVKEY}
ENV FULLCHAIN=${FULLCHAIN}

COPY apps/miniapp/ apps/miniapp/
RUN if [ "$BUILD_MINIAPP" = "true" ]; then \
      npm run build --prefix apps/miniapp && \
      mkdir -p apps/miniapp/dist && \
      cp -R apps/miniapp/.next apps/miniapp/dist/.next && \
      if [ -d apps/miniapp/public ]; then cp -R apps/miniapp/public apps/miniapp/dist/public; fi; \
    else \
      mkdir -p apps/miniapp/dist; \
    fi

FROM deps AS build-gateway
COPY apps/gateway/ apps/gateway/
RUN npm run build --prefix apps/gateway

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY apps/gateway/package*.json apps/gateway/
RUN npm install --omit=dev --prefix apps/gateway

COPY --from=build-gateway /app/apps/gateway/dist apps/gateway/dist
COPY --from=build-miniapp /app/apps/miniapp/dist apps/miniapp/dist

EXPOSE 8443
CMD ["node", "apps/gateway/dist/index.js"]
