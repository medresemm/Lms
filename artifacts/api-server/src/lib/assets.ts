import fs from "node:fs";
import path from "node:path";

/**
 * Serverless-təhlükəsiz asset axtarışı.
 *
 * Vercel Function-da `import.meta.url` və ya `__dirname` əsasında fayl oxumaq
 * etibarlı deyil (kod bundle/transpile olunur). Bu helper bir neçə mümkün yerdə
 * axtarır və heç vaxt exception atmır — asset tapılmasa `null` qaytarır.
 *
 * Asset-lər `artifacts/api-server/src/assets` qovluğunda saxlanılır və
 * vercel.json-da `includeFiles` ilə Function paketinə əlavə olunur.
 */
function candidateDirs(): string[] {
  const cwd = process.cwd();
  const dirs = [
    path.join(cwd, "artifacts/api-server/src/assets"), // Vercel (repo root) / lokal root
    path.join(cwd, "src/assets"), // lokal: artifacts/api-server qovluğundan
    path.join(cwd, "dist/assets"), // lokal: esbuild build nəticəsi
    path.join(cwd, "assets"),
  ];
  if (typeof __dirname !== "undefined") {
    dirs.push(path.join(__dirname, "assets"), path.join(__dirname, "../assets"));
  }
  return dirs;
}

export function findAssetPath(relativePath: string): string | null {
  for (const dir of candidateDirs()) {
    const candidate = path.join(dir, relativePath);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // növbəti namizədə keç
    }
  }
  return null;
}

export function readAsset(relativePath: string): Buffer | null {
  const found = findAssetPath(relativePath);
  if (!found) return null;
  try {
    return fs.readFileSync(found);
  } catch {
    return null;
  }
}
