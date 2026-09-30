import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createLogger, defineConfig } from 'vite';

const isBuild = process.argv.includes('build');

// Build zamanı PORT/BASE_PATH verilməyibsə (məs. Vercel) təhlükəsiz default istifadə olunur.
// Dev/preview üçün PORT hələ də tələb olunur.
const rawPort = process.env.PORT ?? (isBuild ? '25495' : undefined);

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? (isBuild ? '/' : undefined);
const viteLogger = createLogger();
const logger = {
  ...viteLogger,
  warn(message: string, options?: Parameters<typeof viteLogger.warn>[1]) {
    if (!message.includes("Can't resolve original location of error")) {
      viteLogger.warn(message, options);
    }
  },
};

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  customLogger: logger,
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    ...(isBuild
      ? []
      : [
          await import('@replit/vite-plugin-runtime-error-modal')
            .then((m) => m.default())
            .catch(() => null),
        ].filter(Boolean)),
    ...(!process.argv.includes('build') &&
    process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'wouter', '@tanstack/react-query'],
          'vendor-clerk': ['@clerk/react', '@clerk/themes'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react', 'sonner', 'date-fns'],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
