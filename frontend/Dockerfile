# ── Builder stage ─────────────────────────────────────────────────────────────
FROM node:20.20.1-alpine3.23 AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20.20.1-alpine3.23

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
RUN npm install -g serve

COPY --from=builder --chown=app:app /app .

USER app

EXPOSE 5173
CMD ["serve", "dist", "-l", "5173"]
