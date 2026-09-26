# GitHub, Vercel və Supabase keçidi

Bu export mənbə kodunun tam nüsxəsidir. Hazırkı Replit workflow-larında işləyir və lokalda yenidən qurula bilər. GitHub-a yükləyib Vercel-də yayınlamazdan əvvəl aşağıdakı mərhələlər tamamlanmalıdır.

## 1. GitHub

1. Arxivi açın və bütün mənbə kodunu yeni GitHub repository-yə göndərin.
2. `node_modules`, `dist`, `.env` və secret dəyərlərini repository-yə əlavə etməyin.
3. `pnpm-lock.yaml` faylını saxlayın; dependency versiyalarının sabit qalması üçün lazımdır.
4. GitHub repository Settings → Secrets and variables bölməsində production secret-ləri saxlayın.

## 2. Supabase PostgreSQL

Bu layihənin verilənlər bazası PostgreSQL + Drizzle ORM istifadə edir. Supabase PostgreSQL bağlantısı ilə işləyə bilər:

1. Supabase layihəsi yaradın.
2. Supabase Connect bölməsindən production connection string götürün.
3. `DATABASE_URL` olaraq Vercel/API mühitinə əlavə edin.
4. Sxemi tətbiq etməzdən əvvəl backup yaradın.
5. Sxemi layihənin etibarlı build mühitindən tətbiq edin:

```bash
pnpm install
DATABASE_URL="SUPABASE_CONNECTION_STRING" pnpm --filter @workspace/db run push
```

Production database-ə `push-force` işlətməyin. Sxem dəyişikliklərini əvvəlcə ayrıca development Supabase layihəsində yoxlayın.

## 3. Vercel frontend

Root-da olan `vercel.json` frontend build-i üçün hazırdır:

- Build command: `BASE_PATH=/ pnpm --filter @workspace/medine-lms run build && rm -rf public && src=$(find . -type f -path '*/dist/public/index.html' -print -quit) && test -n "$src" && cp -R "$(dirname "$src")" public`
- Output directory: `public` (Vercel üçün son staging qovluğu; command build nəticəsində yaranan `dist/public/index.html` faylını avtomatik tapır)
- SPA rewrite: bütün frontend route-ları `index.html`-ə yönləndirir
- Framework preset: `Vite` — `Express` seçilməməlidir; əks halda Vercel `app.ts`/`server.ts` entrypoint-i axtarır

Vercel-də mümkün olduqda repository root-u project root kimi seçin (`artifacts/api-server` və `artifacts/medine-lms` yox) və package manager olaraq pnpm istifadə edin. Mövcud layihədə Root Directory artıq `artifacts/medine-lms` seçilibsə, bu exportun command-i həmin quruluşu da dəstəkləyir. Framework hələ `Express` görünürsə, **Settings → Build and Deployment → Framework Preset** bölməsində `Vite` seçib yenidən yayınlayın.

Frontend üçün ən azı bu environment dəyişənləri lazımdır:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL` — Clerk proxy arxitekturası saxlanılacaqsa
- `VITE_SYSTEM_OWNER_EMAIL`
- `VITE_SYSTEM_OWNER_NAME`

## 4. API yerləşdirməsi

API üçün Vercel Function giriş nöqtəsi `api/[...path].ts` faylındadır. Bu, mövcud Express tətbiqini `/api/*` sorğuları üçün serverless Function kimi istifadə edir; `src/index.ts`-dəki `PORT` üzərində daimi dinləmə Vercel Function tərəfindən istifadə edilmir.

Vercel layihəsində bu ayarları istifadə edin:

- Root Directory: repository root (`.`), `artifacts/api-server` yox
- Framework Preset: `Vite`
- Frontend Output Directory: `public`
- API Function route: `/api/*`

API üçün production environment variables:

- `DATABASE_URL` — Supabase Transaction Pooler connection string
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `SYSTEM_OWNER_EMAIL`
- `SYSTEM_OWNER_NAME`
- `ADMIN_USER_IDS`
- `LOG_LEVEL`
- `NODE_ENV=production`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — email göndərmə üçün (bax: bölmə 5)
- `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET` — fayl saxlama üçün (bax: bölmə 5)

Vercel Function-u yayımlamazdan əvvəl ən azı `/api/healthz` endpoint-i və Clerk ilə qorunan bir endpoint-i yoxlayın. Serverless sorğularda uzunmüddətli in-memory state və local disk storage-a güvənməyin.

## 5. Fayl storage və email (Replit-dən köçürülüb)

Bu export artıq Replit-ə xüsusi olan iki hissəni portativ alternativlərlə əvəz edir:

**Fayl storage** — `applicationStorage.ts` indi Supabase Storage-in S3-uyumlu API-sindən istifadə edir (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). Tələb olunanlar:

1. Supabase-də **private** bucket yaradın.
2. Supabase → Project Settings → Storage → "S3 Connection" bölməsindən endpoint, region, access key ID və secret access key götürün.
3. Bunları `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET` olaraq Vercel-ə əlavə edin.
4. Signed upload/read URL-lərini və authenticated PDF/file endpoint-lərini test edin.

**Email** — `applicationEmail.ts` indi Resend API-si ilə işləyir. Tələb olunanlar:

1. Resend-də hesab açıb domeninizi doğrulayın.
2. `RESEND_API_KEY` və `RESEND_FROM_EMAIL` (doğrulanmış domendən bir ünvan) Vercel-ə əlavə edin.
3. Müraciət qərarı, fənn silmə qərarı, kritik hadisə bildirişi və məzuniyyət şəhadətnaməsi e-poçtlarının hər birini production-a keçməzdən əvvəl test edin.

## 6. Auth migration qeydi

Frontend və API Clerk istifadə edir. Vercel-də eyni Clerk instance istifadə olunacaqsa, Clerk domain/proxy və production publishable/secret key-ləri ayrıca konfiqurasiya edilməlidir. `CLERK_SECRET_KEY` və digər secret-ləri source code-a yazmayın.

## 7. Production yoxlama siyahısı

- [ ] GitHub repository-də `.env` və secret yoxdur
- [ ] Supabase schema development layihəsində tətbiq olunub
- [ ] `DATABASE_URL` production API-də qurulub
- [ ] Clerk production domain və key-lər yoxlanılıb
- [ ] Supabase Storage bucket yaradılıb və `SUPABASE_S3_*` dəyişənləri qurulub
- [ ] Resend domeni doğrulanıb və `RESEND_API_KEY` / `RESEND_FROM_EMAIL` qurulub
- [ ] Vercel frontend build-i uğurludur
- [ ] API `/api/healthz` cavab verir
- [ ] Login, müraciət, tələbə paneli və müəllim paneli smoke-test edilib
- [ ] PDF və digər fayl upload/download axınları yoxlanılıb
- [ ] Müraciət qərarı və digər email axınları test edilib
- [ ] `pnpm run typecheck` və API/web build uğurludur
