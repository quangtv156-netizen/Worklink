# ---------- Stage 1: build frontend (Vite) ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/
COPY shared/ ./shared/
# Để trống VITE_API_URL => frontend gọi API cùng domain (same-origin)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# ---------- Stage 2: production (Express phục vụ API + dist) ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY database/ ./database/
COPY shared/ ./shared/
COPY scripts/ ./scripts/
COPY public/ ./public/
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads/cv && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server/index.js"]
