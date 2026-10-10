// lms_resources.is_group sütunu (lib/db/manual-sql/2026-10-10-resource-group-flag.sql).
// Sütun hələ yoxdursa, sayt əvvəlki kimi işləyir: qrup yalnız müəllimlə yaradılır.
// Sütunun varlığı information_schema ilə yoxlanılır ki, tranzaksiya daxilində xəta yaranmasın.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export * from "./resourceGroupsCore.js";

export const GROUP_FLAG_MISSING_MESSAGE =
  "Müəllimsiz qrup yaratmaq hələ aktiv deyil: verilənlər bazasında «is_group» sütunu yoxdur. Sahib lib/db/manual-sql/2026-10-10-resource-group-flag.sql faylını Supabase SQL Editor-da işə salmalıdır. O vaxta qədər qrupu yaradarkən müəllim seçin.";

const MISSING_RECHECK_MS = 30_000;
let known: { available: boolean; at: number } | null = null;

type Executor = Pick<typeof db, "execute">;

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
}

export async function groupFlagAvailable(executor: Executor = db): Promise<boolean> {
  if (known && (known.available || Date.now() - known.at < MISSING_RECHECK_MS)) return known.available;
  try {
    const result = await executor.execute(sql`select 1 as ok from information_schema.columns where table_schema = current_schema() and table_name = 'lms_resources' and column_name = 'is_group' limit 1`);
    known = { available: rowsOf(result).length > 0, at: Date.now() };
  } catch {
    known = { available: false, at: Date.now() };
  }
  return known.available;
}

/** Testlər və SQL işə salındıqdan sonra dərhal yenidən yoxlamaq üçün. */
export function resetGroupFlagCache() {
  known = null;
}

/** is_group = true olan sətirlərin id-ləri (sütun yoxdursa boş). */
export async function flaggedGroupIds(executor: Executor = db): Promise<Set<number>> {
  if (!await groupFlagAvailable()) return new Set();
  const result = await executor.execute(sql`select id from lms_resources where is_group = true`);
  return new Set(rowsOf(result).map((row) => Number(row.id)).filter((id) => Number.isInteger(id)));
}

/** Bayrağı yazır; sütun yoxdursa heç nə etmir (false qaytarır). */
export async function setGroupFlag(executor: Executor, resourceId: number, value: boolean): Promise<boolean> {
  if (!await groupFlagAvailable()) return false;
  await executor.execute(sql`update lms_resources set is_group = ${value} where id = ${resourceId}`);
  return true;
}
