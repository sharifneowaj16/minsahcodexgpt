FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_REALTIME_WS_URL=wss://realtime.minsahbeauty.cloud/ws
ARG NEXT_PUBLIC_WS_AUTH_SECRET=438e261811e8de9de98d1d1d4b87d68d315fa1494166226f
ARG NEXT_PUBLIC_APP_URL=https://minsahbeauty.cloud
ARG NEXT_PUBLIC_MINIO_PUBLIC_URL=https://minio.minsahbeauty.cloud

ENV NEXT_PUBLIC_REALTIME_WS_URL=$NEXT_PUBLIC_REALTIME_WS_URL
ENV NEXT_PUBLIC_WS_AUTH_SECRET=$NEXT_PUBLIC_WS_AUTH_SECRET
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MINIO_PUBLIC_URL=$NEXT_PUBLIC_MINIO_PUBLIC_URL

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
