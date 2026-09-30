#!/bin/sh
# Vercel build addımları (vercel.json-da buildCommand 256 simvoldan uzun ola bilmədiyi üçün ayrıca fayldadır).
set -eu

PNPM="npx --yes pnpm@10.17.1"

# 1) Frontend (Vite) -> artifacts/medine-lms/dist/public
BASE_PATH=/ $PNPM --filter @workspace/medine-lms run build

# 2) API -> artifacts/api-server/dist-vercel/handler.mjs (api/[...path].js bunu yükləyir)
$PNPM --filter @workspace/api-server run build:vercel

# 3) Frontend nəticəsini Vercel-in outputDirectory-si olan public/ qovluğuna köçür
rm -rf public
src=$(find . -type f -path '*/dist/public/index.html' -not -path '*/node_modules/*' -print -quit)
if [ -z "$src" ]; then
  echo "Frontend build nəticəsi (dist/public/index.html) tapılmadı" >&2
  exit 1
fi
cp -R "$(dirname "$src")" public
echo "Frontend public/ qovluğuna köçürüldü: $(dirname "$src")"
