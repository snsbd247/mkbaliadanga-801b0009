# ---- builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_PUBLIC_FILES
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_PUBLIC_FILES=$VITE_PUBLIC_FILES
# Copy the entire repo (the Vite app lives at the repo root).
COPY . .
RUN npm install --no-audit --no-fund --legacy-peer-deps
RUN npm run build

# ---- runtime: static via nginx ----
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
