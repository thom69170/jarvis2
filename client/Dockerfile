# Build stage: compile the Vite app using the full workspace (needed for npm ci to resolve).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY client ./client
RUN npm run build -w client

# Runtime stage: static files served by nginx, proxying /api to the server container.
FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
