import { defineConfig } from 'vite';

const openBrowser = process.env.VITE_OPEN !== 'false';

export default defineConfig({
  base: './',
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    open: openBrowser
  }
});
