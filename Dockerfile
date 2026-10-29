# The verified source snapshot is kept as an archive because Git CLI credentials
# were not available. Docker extracts it; no database or secret is in this image.
FROM node:22-alpine AS build
WORKDIR /app
ADD lhl76-source.tar.gz /app/
RUN corepack enable && pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate && NEXT_STANDALONE=1 pnpm build
RUN mkdir -p public/uploads && cp -a public/uploads /app/uploads-seed
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 RATE_LIMIT_DIR=/app/state/limits HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/uploads-seed ./uploads-seed
COPY --from=build --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/state /app/.next/cache && chown -R node:node /app/state /app/.next/cache && sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh
EXPOSE 3000
USER node
CMD ["/app/docker-entrypoint.sh"]
