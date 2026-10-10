-- Kitabxana: yüklənmiş PDF kitablar və dərs kitabları.
-- Avtomatik işə salınmır. Sahib bazanın ehtiyat nüsxəsini aldıqdan sonra tətbiq edir:
--   a) pnpm --filter @workspace/db run push   (eyni CREATE əmrlərini + 4 zərərsiz "SET DEFAULT '{}'" əmrini icra edir)
--   b) və ya bu faylı birbaşa: psql "$DATABASE_URL" -f lib/db/manual-sql/2026-10-09-library-tables.sql
-- Mətn `drizzle-kit` ilə (yalnız göstəriş, tətbiq etmədən) yaradılıb.
BEGIN;

CREATE TABLE IF NOT EXISTS "lms_library_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"storage_id" text NOT NULL,
	"title" text NOT NULL,
	"short_title" text NOT NULL,
	"author" text NOT NULL,
	"commentator" text,
	"publisher" text DEFAULT '' NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"page_count" integer NOT NULL,
	"page_offset" integer DEFAULT 0 NOT NULL,
	"chapters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_text" boolean DEFAULT false NOT NULL,
	"has_cover" boolean DEFAULT false NOT NULL,
	"file_size" integer NOT NULL,
	"original_file_name" text,
	"uploaded_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lms_library_books_slug_unique" ON "lms_library_books" USING btree ("slug");

CREATE TABLE IF NOT EXISTS "lms_course_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"term_number" integer NOT NULL,
	"books" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_by_clerk_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lms_course_books_course_term_unique" ON "lms_course_books" USING btree ("course_id","term_number");

COMMIT;

-- Yoxlama (SQL Editor-da, saytın DATABASE_URL-dəki layihədə işə salın):
--   SELECT current_database(), current_setting('search_path'),
--          to_regclass('public.lms_library_books') AS library_books,
--          to_regclass('public.lms_course_books')  AS course_books;
--   SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE c.relname IN ('lms_library_books', 'lms_course_books');
-- Hər iki to_regclass NULL-dursa, cədvəllər bu bazada yoxdur (başqa layihə və ya COMMIT olunmayıb).
-- Canlı server tərəfdən: https://www.madinahacademy.net/api/healthz?deep=1 → "libraryTables".
