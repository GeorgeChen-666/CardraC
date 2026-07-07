import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    loader: 'jsx',
    include: /src[\\/]renderer[\\/].*\.[jt]sx?$/,
  },
  test: {
    environmentMatchGlobs: [
      ['src/renderer/**/*.test.{js,jsx,ts,tsx}', 'jsdom'],
    ],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: [
      '**/*.no_test.{js,jsx,ts,tsx}',
      '**/node_modules/**',
      '**/.webpack/**',
      '**/.vite/**',
    ],
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    fileParallelism: false,
    watchExclude: ['**/.webpack/**'],
  },
});

