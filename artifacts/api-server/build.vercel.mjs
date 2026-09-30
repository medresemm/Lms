import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

// Vercel Function üçün Express API-ni tək ESM faylına bundle edir.
// Nəticə: artifacts/api-server/dist-vercel/handler.mjs
// (Eyni ESM + createRequire banner-i lokal build.mjs-də də istifadə olunur.)
globalThis.require = createRequire(import.meta.url);

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

console.log(
  "Vercel API bundle hazırdır:",
  path.relative(process.cwd(), path.resolve(outDir, "handler.mjs")),
);
