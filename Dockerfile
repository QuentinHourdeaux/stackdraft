FROM denoland/deno:2.9.1 AS build

WORKDIR /app

COPY deno.json deno.lock package.json ./
RUN deno install --frozen

COPY frontend ./frontend
RUN deno task build

FROM denoland/deno:2.9.1 AS runtime

ENV DENO_DIR=/deno-dir \
    DENO_NO_PROMPT=1 \
    DENO_NO_UPDATE_CHECK=1 \
    STACKDRAFT_HOST=0.0.0.0 \
    STACKDRAFT_PORT=8000 \
    STACKDRAFT_DATABASE_PATH=/data/stackdraft.sqlite \
    STACKDRAFT_LOG_LEVEL=info

WORKDIR /app

COPY --from=build /deno-dir /deno-dir
COPY --from=build /app/node_modules ./node_modules
COPY deno.json deno.lock package.json ./
COPY api ./api
COPY migrations ./migrations
COPY scripts/docker-entrypoint.sh /usr/local/bin/stackdraft-entrypoint
COPY --from=build /app/dist ./dist

RUN mkdir -p /data \
  && chown deno:deno /data \
  && chmod +x /usr/local/bin/stackdraft-entrypoint

ENTRYPOINT ["stackdraft-entrypoint"]

EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["deno", "eval", "const response = await fetch('http://127.0.0.1:8000/api/health'); if (!response.ok) Deno.exit(1);"]

CMD ["deno", "run", "--allow-env", "--allow-net", "--allow-read=/app,/data", "--allow-write=/data", "api/main.ts"]
