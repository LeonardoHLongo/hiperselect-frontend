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

# IMPORTANTE: Variáveis NEXT_PUBLIC_* são injetadas no BUILD TIME
# Railway passa variáveis de ambiente automaticamente, mas precisamos garantir que estejam disponíveis
# Se a variável não estiver disponível durante o build, usar placeholder que será substituído em runtime
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-__NEXT_PUBLIC_API_URL__}

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

# Copiar e configurar entrypoint para substituir variáveis em runtime
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000

# Usar entrypoint para injetar variáveis antes de iniciar o servidor
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]

