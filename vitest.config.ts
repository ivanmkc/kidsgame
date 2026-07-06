import { defineConfig } from 'vitest/config';

// react-native ships untranspiled Flow — alias to react-native-web (the
// shipped surface anyway) so tests can import modules that touch RN.
// Image assets are stubbed: tests never need real pixel data.
export default defineConfig({
  resolve: {
    alias: { 'react-native': 'react-native-web' },
  },
  plugins: [
    {
      name: 'stub-image-assets',
      enforce: 'pre',
      resolveId(id) {
        if (id.replace(/\.tsx?$/, '').endsWith('assets/images')) return '\0stub-images';
        return null;
      },
      load(id) {
        if (id !== '\0stub-images') return null;
        return `const p = new Proxy({}, { get: () => ({ uri: 'stub.png' }) });
export const SPOTIT_ICONS = p;
export const SPOTIT_SHADOWS = p;
export const SCENE_IMAGES = p;
export const SCENE_THUMBS = p;
export const UI_IMAGES = p;`;
      },
    },
  ],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '.claude/**'],
    environment: 'node',
  },
});
