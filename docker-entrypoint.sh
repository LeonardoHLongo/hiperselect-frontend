#!/bin/sh
set -e

# Substituir placeholders de variáveis NEXT_PUBLIC_* nos arquivos JavaScript compilados
# Isso permite que variáveis sejam injetadas em runtime ao invés de build time

echo "🔧 Injecting environment variables into Next.js build..."

if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  echo "  → NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
  
  # Buscar todos os arquivos .js no diretório .next que podem conter o placeholder
  find .next -type f \( -name "*.js" -o -name "*.json" \) 2>/dev/null | while read file; do
    # Substituir placeholder por valor real (usar sed se disponível, senão skip)
    if command -v sed >/dev/null 2>&1; then
      sed -i "s|__NEXT_PUBLIC_API_URL__|$NEXT_PUBLIC_API_URL|g" "$file" 2>/dev/null || true
    fi
  done
  
  echo "✅ Environment variables injected"
else
  echo "⚠️  NEXT_PUBLIC_API_URL not set, using default localhost:3001"
fi

# Executar o comando original
exec "$@"
