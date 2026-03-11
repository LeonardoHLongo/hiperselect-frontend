FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Criar diretório public se não existir (Next.js standalone precisa dele)
RUN mkdir -p public

# IMPORTANTE: Variáveis NEXT_PUBLIC_* precisam estar disponíveis durante o build
# Railway passa variáveis de ambiente automaticamente, mas precisamos garantir que sejam acessíveis
# Usar --build-arg para passar durante o build, ou ENV para runtime (Railway faz isso automaticamente)
# O Next.js lê process.env.NEXT_PUBLIC_* durante o build, então as variáveis devem estar no ambiente
RUN echo "Building with NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-not-set}"

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar public (pode estar vazio, mas Next.js standalone precisa do diretório)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]

