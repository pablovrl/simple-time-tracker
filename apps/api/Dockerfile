# Build from the repository root:
# docker build -f apps/api/Dockerfile -t simple-time-tracker-api .
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

RUN npm install --global npm@12.2.2

# Keep the workspace structure and use the shared lockfile.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

FROM dependencies AS build
RUN npm ci --workspace api --include=dev
COPY apps/api ./apps/api
RUN npm run build --workspace api

FROM dependencies AS production-dependencies
RUN npm ci --workspace api --omit=dev \
    && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
