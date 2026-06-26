# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install OpenSSL (Prisma) + Chromium (puppeteer-core PDF generation) + fonts
# Chromium on Debian bookworm needs: libnss3, libatk1.0-0, libatk-bridge2.0-0,
# libcups2, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxrandr2,
# libgbm1, libasound2 — pulled in as deps of the chromium package.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p uploads logs
EXPOSE 3000
CMD ["node", "dist/index.js"]