import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { generateImages } from './gen_images_ts.mjs';

const root = path.resolve(__dirname, '..');
const committedAssetsDir = path.join(root, 'src/assets');

describe('tools/gen_images_ts.mjs', () => {
  const tempDirs: string[] = [];

  beforeAll(() => {
    const req = createRequire(import.meta.url);
    req.extensions['.png'] = (m) => {
      m.exports = 1;
    };
    req.extensions['.jpg'] = (m) => {
      m.exports = 1;
    };
  });

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    tempDirs.length = 0;
  });

  it('runs the generator in a temp dir and asserts output equals committed files', () => {
    const tempDir = makeTempDir('gen_images_out-');
    generateImages({ root, outDir: tempDir });

    const expectedImagesTs = fs.readFileSync(path.join(committedAssetsDir, 'images.ts'), 'utf8');
    const expectedIconsTs = fs.readFileSync(path.join(committedAssetsDir, 'images/icons.ts'), 'utf8');
    const expectedRhymeTs = fs.readFileSync(path.join(committedAssetsDir, 'images/rhyme.ts'), 'utf8');

    const generatedImagesTs = fs.readFileSync(path.join(tempDir, 'images.ts'), 'utf8');
    const generatedIconsTs = fs.readFileSync(path.join(tempDir, 'images/icons.ts'), 'utf8');
    const generatedRhymeTs = fs.readFileSync(path.join(tempDir, 'images/rhyme.ts'), 'utf8');

    expect(generatedImagesTs).toBe(expectedImagesTs);
    expect(generatedIconsTs).toBe(expectedIconsTs);
    expect(generatedRhymeTs).toBe(expectedRhymeTs);
  });

  it('generates matching files when invoked via CLI with an output directory argument', () => {
    const tempDir = makeTempDir('gen_images_cli_out-');
    const scriptPath = path.join(root, 'tools/gen_images_ts.mjs');

    execFileSync(process.execPath, [scriptPath, tempDir], { encoding: 'utf8' });

    const expectedImagesTs = fs.readFileSync(path.join(committedAssetsDir, 'images.ts'), 'utf8');
    const expectedIconsTs = fs.readFileSync(path.join(committedAssetsDir, 'images/icons.ts'), 'utf8');
    const expectedRhymeTs = fs.readFileSync(path.join(committedAssetsDir, 'images/rhyme.ts'), 'utf8');

    expect(fs.readFileSync(path.join(tempDir, 'images.ts'), 'utf8')).toBe(expectedImagesTs);
    expect(fs.readFileSync(path.join(tempDir, 'images/icons.ts'), 'utf8')).toBe(expectedIconsTs);
    expect(fs.readFileSync(path.join(tempDir, 'images/rhyme.ts'), 'utf8')).toBe(expectedRhymeTs);
  });

  it('loads and executes generated image modules with required assets', async () => {
    const icons = await import('../src/assets/images/icons');
    const rhyme = await import('../src/assets/images/rhyme');

    // The '?bypass-stub' query defeats vitest.config.ts's 'stub-image-assets' plugin
    // (which intercepts imports ending in 'assets/images' and replaces them with a Proxy stub)
    // so the test loads and exercises the real committed images.ts file.
    const imagesPath = '../src/assets/images.ts?bypass-stub';
    const images = (await import(/* @vite-ignore */ imagesPath)) as typeof import('../src/assets/images');

    // Assert on values produced by our mock asset loader (exports 1) rather than the Proxy stub
    // in vitest.config.ts (which returns { uri: 'stub.png' }) to ensure real modules were executed.
    expect(icons.SPOTIT_ICONS.dog).toBe(1);
    expect(icons.SPOTIT_SHADOWS.dog).toBe(1);
    expect(icons.DRESSUP_ICONS.dress_pink).toBe(1);
    expect(icons.CHARACTER_ICONS.princess_pink).toBe(1);
    expect(icons.ANIMAL_ICONS.dog_stand).toBe(1);
    expect(icons.UI_IMAGES.logo).toBe(1);

    expect(rhyme.RHYME_SPRITES.bat).toBe(1);

    expect(images.SPOTIT_ICONS.dog).toBe(1);
    expect(images.RHYME_SPRITES.bat).toBe(1);
    expect(images.SCENE_IMAGES['diff/aquarium_base.png']).toBe(1);
  });
});
