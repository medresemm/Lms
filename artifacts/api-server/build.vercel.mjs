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

function vendorPackage(name, fromDir, rootNodeModules, placed, optional = false, parentDest = null) {
  const srcDir = findPackageDir(fromDir, name);
  if (!srcDir) {
    if (optional) return;
    throw new Error(`Vercel bundle: "${name}" paketi tapılmadı (${fromDir} üzərindən axtarıldı)`);
  }
  const pkg = JSON.parse(readFileSync(path.join(srcDir, "package.json"), "utf8"));

  const levelOf = (dir) => {
    if (!placed.has(dir)) placed.set(dir, new Map());
    return placed.get(dir);
  };

  // Əvvəlcə kökdəki node_modules-a (hoisted) qoymağa çalışırıq. Orada eyni adlı, FƏRQLİ versiyalı paket
  // varsa, bu paketi onu tələb edən paketin öz node_modules qovluğuna (nested) qoyuruq — Node bunu düzgün tapır.
  let nodeModulesDir = rootNodeModules;
  const root = levelOf(rootNodeModules);
  if (root.has(name)) {
    if (root.get(name) === pkg.version) return;
    if (!parentDest) {
      throw new Error(`Vercel bundle: "${name}" üçün fərqli versiyalar (${root.get(name)} və ${pkg.version})`);
    }
    nodeModulesDir = path.join(parentDest, "node_modules");
    const nested = levelOf(nodeModulesDir);
    if (nested.get(name) === pkg.version) return;
    nested.set(name, pkg.version);
  } else {
    root.set(name, pkg.version);
  }

  const destDir = path.join(nodeModulesDir, ...name.split("/"));
  mkdirSync(path.dirname(destDir), { recursive: true });
  cpSync(srcDir, destDir, {
    recursive: true,
    dereference: true,
    filter: (src) => path.basename(src) !== "node_modules",
  });

  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    vendorPackage(dep, srcDir, rootNodeModules, placed, false, destDir);
  }
  for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
    vendorPackage(dep, srcDir, rootNodeModules, placed, true, destDir);
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
console.log("Köçürülən paketlər (kök):", [...(placed.get(vendorNodeModules)?.keys() ?? [])].join(", "));

console.log(
  "Vercel API bundle hazırdır:",
  path.relative(process.cwd(), path.resolve(outDir, "handler.mjs")),
);
