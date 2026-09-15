FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY server/*.ts ./server/
COPY src/features/ai/guidance.ts ./src/features/ai/guidance.ts
COPY src/features/ai/draftTemplate.ts ./src/features/ai/draftTemplate.ts
COPY src/features/ai/firewall.ts ./src/features/ai/firewall.ts
COPY src/features/refunds/payoutTypes.ts ./src/features/refunds/payoutTypes.ts
COPY src/lib/permissions.ts ./src/lib/permissions.ts
COPY src/lib/roles.ts ./src/lib/roles.ts
COPY src/features/organizations/signupClinicCatalog.ts ./src/features/organizations/signupClinicCatalog.ts
RUN mkdir -p /data && chown node:node /data
ENV PRIVATE_DATA_DIR=/data
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
EXPOSE 8787
USER node
CMD ["npm", "run", "start:api"]
