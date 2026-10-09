-- Onlayn dərsə qoşulma qeydləri (avtomatik davamiyyət). lib/db/src/schema/lms.ts → lessonJoinEventsTable ilə eynidir.
-- Production-da cədvəl yoxdursa Supabase SQL Editor-da bir dəfə işə salın (təkrar işə salmaq təhlükəsizdir).
-- Yoxlama: SELECT to_regclass('public.lms_lesson_join_events');  -- NULL qaytarırsa cədvəl yoxdur.
CREATE TABLE IF NOT EXISTS "lms_lesson_join_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "resource_id" integer NOT NULL,
  "profile_id" integer NOT NULL,
  "term_number" integer NOT NULL,
  "session_date" text NOT NULL,
  "joined_at" text NOT NULL,
  "punctuality" text NOT NULL,
  CONSTRAINT "lms_lesson_join_events_term_number_check" CHECK ("term_number" BETWEEN 1 AND 8)
);
CREATE UNIQUE INDEX IF NOT EXISTS "lms_lesson_join_events_resource_profile_date_unique"
  ON "lms_lesson_join_events" USING btree ("resource_id", "profile_id", "session_date");
