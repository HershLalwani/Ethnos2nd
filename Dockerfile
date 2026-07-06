# Build the static Next.js export, then run the Bun websocket server, which
# also serves the exported site. One container, one port.

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
# The server only needs the pure-TS game engine and the built site — no node_modules.
COPY --from=build /app/server ./server
COPY --from=build /app/src/game ./src/game
COPY --from=build /app/out ./out
ENV NODE_ENV=production
EXPOSE 3001
CMD ["bun", "server/ws.ts"]
