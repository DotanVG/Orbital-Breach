import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'shared/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: [
      { find: /^three$/, replacement: path.resolve(__dirname, 'client/node_modules/three/build/three.module.js') },
      { find: '@colyseus/sdk', replacement: path.resolve(__dirname, 'client/node_modules/@colyseus/sdk') },
    ],
  },
});
