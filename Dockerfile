# Root Dockerfile for Blocks Release: the pipeline builds from the repo root,
# while the application lives in app/. Same image as app/Dockerfile, with
# every COPY path prefixed for the repo-root build context.
FROM node:24-alpine AS builder

WORKDIR /app

COPY app/package*.json ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY app/ ./

ARG ci_build=dev
ARG VITE_BLOCKS_API_URL
ARG VITE_BLOCKS_PROJECT_KEY
ARG VITE_BLOCKS_X_BLOCKS_KEY
ARG VITE_BLOCKS_APP_DOMAIN
ARG VITE_BLOCKS_OIDC_URL=https://iam.seliseblocks.com
ARG VITE_BLOCKS_OIDC_CLIENT_ID
ARG VITE_BLOCKS_OIDC_SCOPE="openid profile"
ARG VITE_BLOCKS_REDIRECT_URI
ARG VITE_BLOCKS_HOSTED_LOGIN=true

ENV VITE_BLOCKS_API_URL=${VITE_BLOCKS_API_URL}
ENV VITE_BLOCKS_PROJECT_KEY=${VITE_BLOCKS_PROJECT_KEY}
ENV VITE_BLOCKS_X_BLOCKS_KEY=${VITE_BLOCKS_X_BLOCKS_KEY}
ENV VITE_BLOCKS_APP_DOMAIN=${VITE_BLOCKS_APP_DOMAIN}
ENV VITE_BLOCKS_OIDC_URL=${VITE_BLOCKS_OIDC_URL}
ENV VITE_BLOCKS_OIDC_CLIENT_ID=${VITE_BLOCKS_OIDC_CLIENT_ID}
ENV VITE_BLOCKS_OIDC_SCOPE=${VITE_BLOCKS_OIDC_SCOPE}
ENV VITE_BLOCKS_REDIRECT_URI=${VITE_BLOCKS_REDIRECT_URI}
ENV VITE_BLOCKS_HOSTED_LOGIN=${VITE_BLOCKS_HOSTED_LOGIN}

RUN NODE_OPTIONS="--max-old-space-size=4096" npx vite build --mode "${ci_build}" \
  && node scripts/write-release-env.mjs "${ci_build}"

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/*.ts ./server/
COPY --from=builder /app/src/features/ai/*.ts ./src/features/ai/
COPY --from=builder /app/src/features/refunds/payoutTypes.ts ./src/features/refunds/
COPY --from=builder /app/src/features/organizations/signupClinicCatalog.ts ./src/features/organizations/
COPY --from=builder /app/src/lib/permissions.ts /app/src/lib/roles.ts ./src/lib/
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8080
ENV SERVE_FRONTEND=true
ENV PRIVATE_DATA_DIR=/data
USER node
EXPOSE 8080
CMD ["npm", "run", "start:api"]
