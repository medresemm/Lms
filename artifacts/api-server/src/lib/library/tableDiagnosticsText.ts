// Bazadan asılı olmayan hissə (testlər üçün ayrıca).

export type LibraryTablesDiagnostics = {
  database: string | null;
  currentSchema: string | null;
  searchPath: string | null;
  /** public.<cədvəl> mövcuddurmu (to_regclass). */
  inPublic: Record<string, boolean>;
  /** Cədvəlin tapıldığı bütün sxemlər (public-dən başqa yerdə yaradılıbsa görünür). */
  foundInSchemas: Record<string, string[]>;
};

/** Sahib üçün qısa izah: cədvəl başqa sxemdədirsə və ya ümumiyyətlə yoxdursa nə etməli. */
export function describeTableDiagnostics(diag: LibraryTablesDiagnostics, table: string): string {
  const schemas = diag.foundInSchemas[table] ?? [];
  const where = `server «${diag.database ?? "?"}» bazasına qoşulub (search_path: ${diag.searchPath ?? "?"})`;
  if (diag.inPublic[table]) return `${where}; «public.${table}» indi mövcuddur — səhifəni yeniləyin.`;
  if (schemas.length) return `${where}; «${table}» cədvəli «${schemas.join(", ")}» sxemində tapıldı, amma «public»-də yoxdur. Cədvəli public sxemində yaradın.`;
  return `${where}; bu bazada «${table}» cədvəli heç bir sxemdə yoxdur. SQL çox güman ki, başqa Supabase layihəsində (və ya başqa bazada) işə salınıb, ya da COMMIT olunmayıb.`;
}
