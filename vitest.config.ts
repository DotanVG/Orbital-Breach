import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'shared/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      three: path.resolve(__dirname, 'client/node_modules/three/build/three.module.js'),
    },
  },
});
