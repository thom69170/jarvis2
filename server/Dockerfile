# Build stage: compile TypeScript using the full workspace (needed for npm ci to resolve).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY server ./server
RUN npm run build -w server

# Runtime stage: only the compiled server and its own production dependencies.
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./package.json
RUN npm install --omit=dev
COPY --from=build /app/server/dist ./dist
EXPOSE 4000
CMD ["node", "dist/index.js"]
