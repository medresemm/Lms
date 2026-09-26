# Mədinə Tədris Akademiyası LMS

Mədinə Tədris Akademiyasının tələbə, müəllim və idarəetmə axınlarını birləşdirən LMS tətbiqi.

## Lokal işə salma

Tələblər:

- Node.js 20+
- pnpm 10+
- PostgreSQL

```bash
pnpm install
cp .env.example .env
# .env daxilində DATABASE_URL və digər dəyərləri doldurun
pnpm --filter @workspace/db run push
pnpm run typecheck
pnpm --filter @workspace/api-server run dev
```

Frontend ayrıca terminalda:

```bash
PORT=25495 BASE_PATH=/medine-lms pnpm --filter @workspace/medine-lms run dev
```

Tam yoxlama və build:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/medine-lms run build
```

## Layihə quruluşu

- `artifacts/medine-lms` — React + Vite frontend
- `artifacts/api-server` — Express API
- `lib/db` — Drizzle/PostgreSQL sxemi
- `lib/api-spec` — OpenAPI müqaviləsi və codegen
- `lib/api-client-react` — yaradılmış React Query klienti
- `lib/api-zod` — yaradılmış server Zod sxemləri
- `scripts` — regression və köməkçi skriptlər

## Deploy qeydi

GitHub/Vercel/Supabase keçid addımları və hazırkı Replit-ə məxsus fayl storage məhdudiyyətləri üçün `DEPLOYMENT.md` faylına baxın.
