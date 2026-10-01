// Vercel-də `api/[...path].js` yalnız TƏK segmentli yolları tutur (/api/questions).
// Çoxsegmentli yollar (/api/account/profile, /api/admin/...) bu fayla yönləndirilir:
// vercel.json → rewrites: /api/:path* → /api
// Məntiq eynidir, ona görə eyni handler istifadə olunur.
module.exports = require("./[...path].js");
