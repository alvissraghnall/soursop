FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
