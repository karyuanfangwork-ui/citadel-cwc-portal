# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
# Install OpenSSL for Prisma and unzip for Puppeteer's browser download.
RUN apt-get update && apt-get install -y openssl unzip && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
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
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
ARG PDF_SMOKE_TEST=false

# Install OpenSSL (Prisma) + Chrome runtime libraries + fonts.
# PDF generation uses Puppeteer's pinned Chrome for Testing binary copied from
# the builder cache, not Debian's chromium package (which has crashed in prod).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    fonts-liberation \
    fonts-noto-cjk \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.cache/puppeteer ./.cache/puppeteer
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p uploads logs
RUN if [ "$PDF_SMOKE_TEST" = "true" ]; then \
      node -e "require('./dist/credit/services/htmlToPdf.service').htmlToPdf('<html><body><h1>PDF smoke</h1></body></html>').then((pdf)=>{ if (!pdf || pdf.length < 1000) throw new Error('PDF smoke produced an unexpectedly small file'); console.log('PDF smoke bytes', pdf.length); })"; \
    fi
EXPOSE 3000
CMD ["node", "dist/index.js"]
