# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20-bullseye
ARG THIRDWEB_CLIENT_ID=""
ARG VITE_GATEWAY_BASE=""
ARG SWAP_API_BASE=""

FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/gateway/package*.json apps/gateway/
COPY apps/miniapp/package*.json apps/miniapp/

RUN npm ci --prefix apps/gateway \
 && npm ci --prefix apps/miniapp

FROM deps AS build-miniapp
ARG THIRDWEB_CLIENT_ID
ARG VITE_GATEWAY_BASE
ARG SWAP_API_BASE
ENV THIRDWEB_CLIENT_ID=${THIRDWEB_CLIENT_ID}
ENV VITE_THIRDWEB_CLIENT_ID=${THIRDWEB_CLIENT_ID}
ENV VITE_GATEWAY_BASE=${VITE_GATEWAY_BASE}
ENV SWAP_API_BASE=${SWAP_API_BASE}
COPY apps/miniapp/ apps/miniapp/
RUN npm run build --prefix apps/miniapp

FROM deps AS build-gateway
COPY apps/gateway/ apps/gateway/
RUN npm run build --prefix apps/gateway

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY apps/gateway/package*.json apps/gateway/
RUN npm ci --omit=dev --prefix apps/gateway

COPY --from=build-gateway /app/apps/gateway/dist apps/gateway/dist
COPY --from=build-miniapp /app/apps/miniapp/dist apps/miniapp/dist

EXPOSE 7777
CMD ["node", "apps/gateway/dist/index.js"]
