# ⚠️ ƏVVƏL BUNU EDİN: köhnə faylı GitHub-dan silin

Əvvəlki versiyada API giriş faylı `api/[...path].ts` idi. İndi o `api/[...path].js`-dir. GitHub-a yeni faylları yükləmək köhnəni **silmir**. İki fayl qalsa Vercel "conflicting paths or names" xətası ilə build-i dayandırır.

1. GitHub-da repo → `api` qovluğu → `[...path].ts` faylını açın.
2. Sağ yuxarıda `⋯` → **Delete file** → **Commit changes**.
3. `api` qovluğunda yalnız `[...path].js` qalmalıdır.

Ən təmiz yol: repo-nu silib yenisini yaratmaq və zip-in **bütün** məzmununu yükləmək. `.vercelignore` burada kömək etmir, çünki Vercel sənədinə görə ignore qaydaları yalnız Vercel CLI üçündür, Git deploy üçün yox.

---

# GitHub, Vercel və Supabase keçidi

Bu export mənbə kodunun tam nüsxəsidir. Hazırkı Replit workflow-larında işləyir və lokalda yenidən qurula bilər. GitHub-a yükləyib Vercel-də yayınlamazdan əvvəl aşağıdakı mərhələlər tamamlanmalıdır.

## 0. Vercel-də tez-tez rast gəlinən problemlər (bu export-da düzəldilib)

| Problem | Səbəb | Həll |
| --- | --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` (**əsas səbəb**) | `pnpm-lock.yaml` `package.json`-larla uyğun deyil: `api-server`-də `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend` lockfile-da yoxdur; lockfile-da isə artıq istifadə olunmayan `@google-cloud/storage`, `google-auth-library` (və root-da `@replit/connectors-sdk`) qalıb. Vercel `CI`-da `--frozen-lockfile` işlədir və install yıxılır | `vercel.json` install əmri `--no-frozen-lockfile` ilə işləyir. **Bir dəfə lokal `pnpm install` edib yenilənmiş `pnpm-lock.yaml`-ı commit edin** (aşağıda bax) |
| `ERR_PNPM_OUTDATED_LOCKFILE` / `LOCKFILE_CONFIG_MISMATCH` | Lockfile v9 üçün Vercel pnpm 9 seçə bilir; bu layihənin `overrides`/`catalog` ayarları isə `pnpm-workspace.yaml`-dadır və yalnız pnpm 10-da oxunur. `installCommand: "pnpm install"` yazılsa Vercel **pnpm 6** işlədir | `vercel.json`-da `npx --yes pnpm@10.17.1 install --no-frozen-lockfile` (həmişə pnpm 10) |
| `/api/*` bütün sorğulara 500 (`FUNCTION_INVOCATION_FAILED`, `ERR_REQUIRE_ESM`, `Cannot find module`) | `api/[...path].ts` ESM TypeScript workspace paketlərini (`@workspace/db`, `@workspace/api-zod` → `src/index.ts`) `require` edirdi; Vercel runtime bunu dəstəkləmir. Loqo də `import.meta.url` ilə oxunurdu | API build zamanı esbuild ilə **tək `handler.mjs` faylına** bundle olunur (`build.vercel.mjs`); `api/[...path].js` yalnız onu yükləyir |
| Sertifikat PDF işləmir (`ENOENT ... .afm` / `Cannot find module ... standard-fonts`) | `pdfkit` (0.20) öz şrift metrik fayllarını runtime-da diskdən oxuyur; Vercel-in fayl izləməsi pnpm symlink-ləri ilə bunları buraxa bilər | `build.vercel.mjs` `pdfkit`-i və asılılıqlarını real fayl kimi `dist-vercel/node_modules` altına köçürür |
| Sertifikatdakı QR/doğrulama linki `/medine-lms/...` ilə açılır və 404 verir | Kod `BASE_PATH` yoxdursa `/medine-lms` götürürdü (Replit yolu) | Vercel-də default `""` (kök) olaraq düzəldildi |
| Sertifikat PDF-də Azərbaycan hərfləri pozuq | Şriftlər `/usr/share/fonts/...` yolundan götürülürdü, Vercel-də belə yol yoxdur | DejaVu şriftləri `src/assets/fonts`-a əlavə olundu, `includeFiles` ilə paketə düşür |
| DB bağlantı xətası / `too many connections` | Supabase SSL və serverless pool ayarı yox idi | `lib/db/src/index.ts`-də SSL + kiçik pool (Supabase **Transaction Pooler** URL-i istifadə edin) |
| Frontend build: `PORT`/`BASE_PATH is required` | Vite config build zamanı bu dəyişənləri məcburi tələb edirdi | Build üçün default dəyərlər əlavə olundu |
| `pattern ... defined in functions doesn't match any Serverless Functions` | `vercel.json` `functions` açarı `api/` altındakı real fayla uyğun gəlməlidir | Açar `api/**/*.js` glob-udur və `api/[...path].js` fayl kimi repo-dadır |

**Lockfile-ı düzəltmək (tövsiyə olunur):** layihə qovluğunda (pnpm 10.17+ ilə, Node 22/24)
```
pnpm install
git add pnpm-lock.yaml && git commit -m "Update lockfile" && git push
```
Bundan sonra `vercel.json`-da `--no-frozen-lockfile` əvəzinə `--frozen-lockfile` yaza bilərsiniz (deterministik install üçün).

**Diaqnostika:** `/api/healthz` cavab verirsə Function işləyir. `{"error":"API başlaya bilmədi..."}` qaytarsa, Vercel → Logs-da səbəb yazılır (çox vaxt `DATABASE_URL` yoxdur). Qısa müddətə `DEBUG_API_ERRORS=1` env əlavə etsəniz, xəta mətni cavabda da görünər (işiniz bitəndə silin). Clerk açarları yoxdursa `/api/healthz` yenə işləyir, amma digər `/api/*` sorğuları xəta verir.

**Node.js versiyası:** Node 20 Vercel-də ləğv olunur, ona görə `package.json`-da `engines.node = "24.x"` qoyulub. Vercel-də **Settings → Build and Deployment → Node.js Version** da `24.x` olmalıdır; layihə ayarı `engines`-dən üstün ola bilər. 24-ə keçmək istəsəniz hər ikisini `24.x` edin.

Vercel-də **Settings → Environment Variables** bölməsində (Production + Preview) bu dəyişənlər olmalıdır. Bunlar kodun oxuduğu **bütün** dəyişənlərdir:

| Dəyişən | Məcburi? | Nə üçün |
| --- | --- | --- |
| `DATABASE_URL` | bəli | Supabase **Transaction Pooler** ünvanı (port 6543). Yoxdursa API heç başlamır |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | bəli | Giriş sistemi (API) |
| `VITE_CLERK_PUBLISHABLE_KEY` | bəli | Giriş sistemi (frontend, build zamanı) |
| `SYSTEM_OWNER_EMAIL`, `SYSTEM_OWNER_NAME` | bəli | Sistem sahibi (API) |
| `VITE_SYSTEM_OWNER_EMAIL`, `VITE_SYSTEM_OWNER_NAME` | bəli | Sistem sahibi (frontend, build zamanı) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | email üçün | Müraciət və sertifikat emailləri |
| `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `SUPABASE_STORAGE_BUCKET` | fayl yükləmə üçün | Supabase Storage (S3 uyğun) |
| `ADMIN_USER_IDS` | istəyə bağlı | Əlavə admin istifadəçi ID-ləri |
| `VITE_CLERK_PROXY_URL` | istəyə bağlı | Yalnız Clerk proxy istifadə edirsinizsə |
| `NODE_ENV` | lazım deyil | Vercel özü `production` qoyur |

`VITE_*` dəyişənləri build zamanı oxunur — onları dəyişdikdən sonra **yenidən deploy** edin. `BASE_PATH` Vercel-də təyin **etməyin**; build skripti onu `/` edir.

Clerk qeydi: `pk_live_` açarları yalnız Clerk-də təsdiqlənmiş öz domeniniz üçün işləyir; `*.vercel.app` ünvanında test üçün `pk_test_` açarlarından istifadə edin.

İlk yoxlama: `https://SİZİN-DOMEN.vercel.app/api/healthz` → `{"status":"ok"}` qaytarmalıdır.

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

- Install command: `npx --yes pnpm@10.17.1 install --no-frozen-lockfile` (həmişə pnpm 10)
- Build command: `sh scripts/vercel-build.sh` (frontend + API bundle + `public/` köçürməsi; Vercel `buildCommand` üçün 256 simvol limiti qoyur, ona görə skript ayrıca fayldadır)
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

API üçün Vercel Function giriş nöqtəsi `api/[...path].js` faylındadır. O, build zamanı `pnpm --filter @workspace/api-server run build:vercel` ilə yaradılan `artifacts/api-server/dist-vercel/handler.mjs` bundle-ını yükləyir (Express tətbiqi `/api/*` sorğuları üçün serverless Function kimi işləyir); `src/index.ts`-dəki `PORT` üzərində daimi dinləmə Vercel Function tərəfindən istifadə edilmir.

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
