# --- build stage ---
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 needs build tools to compile its native addon
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=build /app/src/client ./dist/client

EXPOSE 3000
CMD ["sh", "-c", "node dist/server/db/migrate.js && node dist/server/index.js"]
