FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate && NEXT_STANDALONE=1 pnpm build
RUN mkdir -p public/uploads && cp -a public/uploads /app/uploads-seed
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV RATE_LIMIT_DIR=/app/state/limits
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/uploads-seed ./uploads-seed
COPY --from=build --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/state /app/.next/cache && chown -R node:node /app/state /app/.next/cache
EXPOSE 3000
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
CMD ["/app/docker-entrypoint.sh"]
USER node
