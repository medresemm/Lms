-- Müəllimsiz qrup: lms_resources.is_group bayrağı. lib/db/src/schema/lms.ts → resourcesTable ilə eynidir.
-- Supabase layihəsi: jhcdmykipipurawqlozr (saytın əsas bazası) → SQL Editor. Təkrar işə salmaq təhlükəsizdir.
-- Yalnız yeni sütun əlavə edir və müəllimi olan mövcud sətirləri qrup kimi işarələyir; heç nə silinmir.
--   is_group = true  → qrup (müəllimli və ya müəllimsiz; müəllimsiz qrup tələbələrə görünmür)
--   is_group = false → «Cədvəl hazırlama»dakı dərs sətri (hələ qrup deyil)
-- Yoxlama: SELECT count(*) FILTER (WHERE is_group) AS groups, count(*) AS rows FROM lms_resources;
BEGIN;

ALTER TABLE "lms_resources" ADD COLUMN IF NOT EXISTS "is_group" boolean DEFAULT false NOT NULL;

-- Backfill: müəllimi olan hər sətir qrupdur (yalnız bayrağı qoyur).
UPDATE "lms_resources" SET "is_group" = true
  WHERE "teacher_clerk_user_id" IS NOT NULL AND "is_group" = false;

CREATE INDEX IF NOT EXISTS "lms_resources_course_term_idx"
  ON "lms_resources" USING btree ("course_id", "term_number");

COMMIT;
