// Vercel Function giriş nöqtəsi (CommonJS wrapper).
//
// Express API build zamanı `artifacts/api-server/build.vercel.mjs` ilə tək ESM faylına
// bundle olunur (workspace TS paketləri və .js→.ts importları runtime-da problem yaratmasın deyə).
// Bu fayl həmin bundle-ı ilk sorğuda yükləyir.

let appPromise;

function loadApp() {
  if (!appPromise) {
    appPromise = import("../artifacts/api-server/dist-vercel/handler.mjs").then(
      (mod) => mod.default,
    );
    // Uğursuz yüklənmə cache-lənməsin (məs. env dəyişəni düzəldilib yenidən deploy olunanda)
    appPromise.catch(() => {
      appPromise = undefined;
    });
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  // Vercel `[...path]` marşrutunda URL-ə `?path=...` əlavə edir; tətbiq bunu istifadə etmir — təmizlənir.
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.has("path")) {
      url.searchParams.delete("path");
      req.url = url.pathname + url.search;
    }
  } catch {
    // URL parse olunmasa olduğu kimi qalır
  }

  let app;
  try {
    app = await loadApp();
  } catch (error) {
    // Runtime Logs-da görünür. Məsələn: "DATABASE_URL must be set" və ya "Cannot find module ..."
    console.error("API yüklənmədi:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "API başlaya bilmədi. Vercel → Logs bölməsinə baxın.",
        ...(process.env.DEBUG_API_ERRORS === "1"
          ? { detail: String(error && error.message ? error.message : error) }
          : {}),
      }),
    );
    return;
  }
  return app(req, res);
};
