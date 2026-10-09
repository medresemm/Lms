// Dərs kitabları — baza (lms_course_books). Cədvəl yoxdursa (miqrasiya edilməyib) oxuma boş siyahı qaytarır,
// yazma isə aydın mesajla 503 verir.
import { courseBooksTable, db } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import type { LibraryBook } from "./catalog.js";
import type { CourseBookEntry, CourseBooksRow } from "./courseBooks.js";
import { builtinCatalog, loadUploadedBooks } from "./uploadedBooks.js";
import { isMissingTableError } from "./uploads.js";

export const COURSE_BOOKS_TABLE_MISSING_MESSAGE =
  "Dərs kitabları hələ aktiv deyil: verilənlər bazasında «lms_course_books» cədvəli yaradılmayıb. Sahib bazanın ehtiyat nüsxəsini aldıqdan sonra cədvəli yaratmalıdır.";

export function isMissingCourseBooksTable(error: unknown) {
  if (isMissingTableError(error)) return true;
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const message = (current as { message?: unknown }).message;
    if (typeof message === "string" && /lms_course_books/.test(message) && /does not exist/.test(message)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Bütün kitablar (daxili + yüklənmiş) — dərs kitablarının yoxlanması və göstərilməsi üçün. */
export async function fullLibraryCatalog(): Promise<LibraryBook[]> {
  const uploaded = await loadUploadedBooks().catch(() => ({ books: [] }));
  return [...builtinCatalog(), ...uploaded.books];
}

export async function loadCourseBooksRows(courseIds?: number[]): Promise<{ available: boolean; rows: CourseBooksRow[] }> {
  try {
    const query = db.select().from(courseBooksTable);
    const rows = courseIds ? (courseIds.length ? await query.where(inArray(courseBooksTable.courseId, courseIds)) : []) : await query;
    return {
      available: true,
      rows: rows.map((row) => ({ courseId: row.courseId, termNumber: row.termNumber, books: Array.isArray(row.books) ? row.books as CourseBookEntry[] : [] })),
    };
  } catch (error) {
    if (isMissingCourseBooksTable(error)) return { available: false, rows: [] };
    throw error;
  }
}

export async function saveCourseBooks(courseId: number, termNumber: number, books: CourseBookEntry[], userId: string) {
  if (!books.length) {
    await db.delete(courseBooksTable).where(and(eq(courseBooksTable.courseId, courseId), eq(courseBooksTable.termNumber, termNumber)));
    return;
  }
  await db.insert(courseBooksTable)
    .values({ courseId, termNumber, books, updatedByClerkUserId: userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [courseBooksTable.courseId, courseBooksTable.termNumber],
      set: { books, updatedByClerkUserId: userId, updatedAt: new Date() },
    });
}
