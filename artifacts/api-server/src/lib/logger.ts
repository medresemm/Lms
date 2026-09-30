import pino from "pino";

// pino-pretty worker transport serverless bundle-da işləmir; yalnız lokal development-də istifadə olunur.
const usePretty = process.env.NODE_ENV === "development" && !process.env.VERCEL;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
