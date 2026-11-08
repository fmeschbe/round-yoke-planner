FROM docker.io/library/node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm test && npm run build

FROM docker.io/nginxinc/nginx-unprivileged:stable-alpine

LABEL org.opencontainers.image.title="Round Yoke Planner" \
      org.opencontainers.image.description="Browser-only round-yoke knitting planner" \
      org.opencontainers.image.source="https://github.com/fmeschbe/round-yoke-planner" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY deployment/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
