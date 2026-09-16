# Build stage
FROM node:22.23.2-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

COPY realtime-service/package.json realtime-service/pnpm-lock.yaml* realtime-service/

WORKDIR /app/realtime-service
RUN pnpm install --no-frozen-lockfile --prod=false

COPY realtime-service/ .
RUN pnpm run build

# Runtime stage
FROM node:22.23.2-alpine

WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S annsetu && adduser -u 1001 -S annsetu -G annsetu

COPY --from=builder /app/realtime-service/dist ./dist
COPY --from=builder /app/realtime-service/node_modules ./node_modules
COPY --from=builder /app/realtime-service/package.json ./

RUN chown -R annsetu:annsetu /app

USER annsetu

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]