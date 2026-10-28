import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], env: { APP_TIMEZONE: 'Asia/Kolkata', MAX_TABLES: '30' } },
});
