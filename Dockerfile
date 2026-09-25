# syntax=docker/dockerfile:1

# ---- Pandawa Backend (Express 5 + PostgreSQL) ----

FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install dependencies produksi saja (tanpa nodemon)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY src ./src

# Script operator (create-admin, reset-data) + schema
COPY scripts ./scripts
COPY db ./db

# Jalankan sebagai non-root user
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Health check memakai endpoint "/" yang sudah ada
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/app.js"]
