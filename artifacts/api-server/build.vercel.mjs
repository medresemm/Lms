import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";

// Vercel Function üçün Express API-ni tək ESM faylına bundle edir.
// Nəticə: artifacts/api-server/dist-vercel/handler.mjs
// (Eyni ESM + createRequire banner-i lokal build.mjs-də də istifadə olunur.)
globalThis.require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// pdfkit və onun asılılıqlarını dist-vercel/node_modules altına real fayl kimi köçürür.
// Səbəb: pdfkit öz data/standard-fonts fayllarını runtime-da diskdən oxuyur; Vercel-in fayl izləməsi
// (pnpm symlink-ləri + dinamik yollar) bunları buraxa bilər. dist-vercel/** vercel.json-da includeFiles
// ilə tam daxil edildiyi üçün bu yanaşma izləmədən asılı deyil.
// ---------------------------------------------------------------------------
function findPackageDir(fromDir, name) {
  let dir = fromDir;
  for (;;) {
    const candidates = [path.join(dir, "node_modules", name)];
    if (path.basename(dir) === "node_modules") candidates.push(path.join(dir, name));
    for (const candidate of candidates) {
      if (existsSync(path.join(candidate, "package.json"))) return realpathSync(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function vendorPackage(name, fromDir, targetNodeModules, placed, optional = false) {
  const srcDir = findPackageDir(fromDir, name);
  if (!srcDir) {
    if (optional) return;
    throw new Error(`Vercel bundle: "${name}" paketi tapılmadı (${fromDir} üzərindən axtarıldı)`);
  }
  const pkg = JSON.parse(readFileSync(path.join(srcDir, "package.json"), "utf8"));

  const already = placed.get(targetNodeModules) ?? new Map();
  placed.set(targetNodeModules, already);
  let nodeModulesDir = targetNodeModules;
  if (already.has(name) && already.get(name) !== pkg.version) {
    throw new Error(`Vercel bundle: "${name}" üçün fərqli versiyalar (${already.get(name)} və ${pkg.version})`);
  }
  if (already.get(name) === pkg.version) return;
  already.set(name, pkg.version);

  const destDir = path.join(nodeModulesDir, ...name.split("/"));
  mkdirSync(path.dirname(destDir), { recursive: true });
  cpSync(srcDir, destDir, {
    recursive: true,
    dereference: true,
    filter: (src) => path.basename(src) !== "node_modules",
  });

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    vendorPackage(dep, srcDir, targetNodeModules, placed);
  }
  for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
    vendorPackage(dep, srcDir, targetNodeModules, placed, true);
  }
}

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(artifactDir, "dist-vercel");

await rm(outDir, { recursive: true, force: true });

await esbuild({
  entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
  outfile: path.resolve(outDir, "handler.mjs"),
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  // pdfkit daxili data fayllarını (şrift metrikləri) runtime-da diskdən oxuyur — bundle olunmur,
  // node_modules-dan Vercel Function paketinə əlavə olunur (vercel.json includeFiles).
  // pg-native isteğe bağlı native modul olduğundan istifadə edilmir.
  external: ["pdfkit", "pg-native", "*.node"],
  banner: {
    js: [
      "import { createRequire as __bannerCrReq } from 'node:module';",
      "import __bannerPath from 'node:path';",
      "import __bannerUrl from 'node:url';",
      "",
      "globalThis.require = __bannerCrReq(import.meta.url);",
      "globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);",
      "globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);",
    ].join("\n"),
  },
});

// Bundle-da kənarda saxlanılan paketləri (pdfkit) yanına köçür.
const vendorNodeModules = path.resolve(outDir, "node_modules");
const placed = new Map();
vendorPackage("pdfkit", artifactDir, vendorNodeModules, placed);
console.log("Köçürülən paketlər:", [...(placed.get(vendorNodeModules)?.keys() ?? [])].join(", "));

console.log(
  "Vercel API bundle hazırdır:",
  path.relative(process.cwd(), path.resolve(outDir, "handler.mjs")),
);
