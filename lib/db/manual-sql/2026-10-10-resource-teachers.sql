-- Bir dərsə (müəllim qrupuna) bir neçə müəllim: əlavə müəllimlər cədvəli. lib/db/src/schema/lms.ts → resourceTeachersTable ilə eynidir.
-- Supabase layihəsi: jhcdmykipipurawqlozr (saytın əsas bazası) → SQL Editor. Təkrar işə salmaq təhlükəsizdir.
-- Yalnız yeni boş cədvəl yaradır; mövcud cədvəllərə və məlumatlara toxunmur.
-- Yoxlama: SELECT to_regclass('public.lms_resource_teachers');  -- NULL qaytarırsa cədvəl yoxdur.
BEGIN;

CREATE TABLE IF NOT EXISTS "lms_resource_teachers" (
  "id" serial PRIMARY KEY NOT NULL,
  "resource_id" integer NOT NULL,
  "teacher_clerk_user_id" text NOT NULL,
  "added_by_clerk_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "lms_resource_teachers_resource_teacher_unique"
  ON "lms_resource_teachers" USING btree ("resource_id", "teacher_clerk_user_id");

CREATE INDEX IF NOT EXISTS "lms_resource_teachers_teacher_idx"
  ON "lms_resource_teachers" USING btree ("teacher_clerk_user_id");

COMMIT;
