import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildInventory, listMediaFiles, readCleanIds, type MediaAsset } from '../inventory';

describe('buildInventory', () => {
  it('classifies images and videos based on extension and drops non-media', () => {
    const paths = [
      'assets/game/diff/dog_0.png',
      'assets/game/story/luna_start.jpg',
      'assets/game/story/luna_alt.jpeg',
      'assets/game/ui/icon.webp',
      'public/story-video/luna_start_0.mp4',
      'public/story-video/pip_loop.webm',
      'public/voice/narration.mp3',
      'public/manifest.json',
      'docs/notes.txt',
    ];
    const cleanIds = new Set<string>(['dog', 'luna']);

    const inventory: MediaAsset[] = buildInventory(paths, cleanIds);

    const pathsInInventory = inventory.map((asset) => asset.path);
    expect(pathsInInventory).toEqual([
      'assets/game/diff/dog_0.png',
      'assets/game/story/luna_alt.jpeg',
      'assets/game/story/luna_start.jpg',
      'assets/game/ui/icon.webp',
      'public/story-video/luna_start_0.mp4',
      'public/story-video/pip_loop.webm',
    ]);

    expect(inventory.find((a) => a.path.endsWith('.png'))?.kind).toBe('image');
    expect(inventory.find((a) => a.path.endsWith('.jpg'))?.kind).toBe('image');
    expect(inventory.find((a) => a.path.endsWith('.jpeg'))?.kind).toBe('image');
    expect(inventory.find((a) => a.path.endsWith('.webp'))?.kind).toBe('image');
    expect(inventory.find((a) => a.path.endsWith('.mp4'))?.kind).toBe('video');
    expect(inventory.find((a) => a.path.endsWith('.webm'))?.kind).toBe('video');
  });

  it('derives game and group for story image and video assets', () => {
    const paths = ['assets/game/story/luna_start.jpg', 'public/story-video/luna_start_0.mp4'];
    const cleanIds = new Set<string>(['luna']);

    const inventory = buildInventory(paths, cleanIds);

    expect(inventory).toEqual([
      {
        path: 'assets/game/story/luna_start.jpg',
        kind: 'image',
        game: 'story',
        group: 'luna',
        ledgerClean: true,
      },
      {
        path: 'public/story-video/luna_start_0.mp4',
        kind: 'video',
        game: 'story-video',
        group: 'luna',
        ledgerClean: true,
      },
    ]);
  });

  it('handles ledgerClean correctly when group is or is not in cleanIds', () => {
    const paths = ['assets/game/story/luna_start.jpg', 'assets/game/story/rex_start.jpg'];
    const cleanIds = new Set<string>(['luna']);

    const inventory = buildInventory(paths, cleanIds);

    const luna = inventory.find((a) => a.group === 'luna');
    const rex = inventory.find((a) => a.group === 'rex');
    expect(luna?.ledgerClean).toBe(true);
    expect(rex?.ledgerClean).toBe(false);
  });

  it('handles filenames without underscore and other directory structures', () => {
    const paths = [
      'assets/game/animals/cat.png',
      'public/escape-sprites/key.png',
      'assets/game/icon.png',
      'other/game/test.png',
    ];
    const cleanIds = new Set<string>(['cat']);

    const inventory = buildInventory(paths, cleanIds);

    const cat = inventory.find((a) => a.path === 'assets/game/animals/cat.png');
    expect(cat?.game).toBe('animals');
    expect(cat?.group).toBe('cat');
    expect(cat?.ledgerClean).toBe(true);

    const key = inventory.find((a) => a.path === 'public/escape-sprites/key.png');
    expect(key?.game).toBe('escape-sprites');
    expect(key?.group).toBe('key');
    expect(key?.ledgerClean).toBe(false);

    const icon = inventory.find((a) => a.path === 'assets/game/icon.png');
    expect(icon?.game).toBe('icon.png');
    expect(icon?.group).toBe('icon');

    const other = inventory.find((a) => a.path === 'other/game/test.png');
    expect(other?.game).toBe('other');
    expect(other?.group).toBe('test');
  });

  it('matches ledger ids with underscores against stem on boundary and picks the longest id', () => {
    const paths = [
      'assets/game/hidden/space_station_t_alien.png',
      'assets/game/hidden/circus_backstage.png',
      'assets/game/hidden/cloud_kingdom_sun.png',
    ];
    const cleanIds = new Set<string>(['space', 'space_station', 'circus_backstage']);

    const inventory = buildInventory(paths, cleanIds);

    const spaceStation = inventory.find((a) => a.path === 'assets/game/hidden/space_station_t_alien.png');
    expect(spaceStation?.group).toBe('space_station');
    expect(spaceStation?.ledgerClean).toBe(true);

    const circusBackstage = inventory.find((a) => a.path === 'assets/game/hidden/circus_backstage.png');
    expect(circusBackstage?.group).toBe('circus_backstage');
    expect(circusBackstage?.ledgerClean).toBe(true);

    const cloudKingdom = inventory.find((a) => a.path === 'assets/game/hidden/cloud_kingdom_sun.png');
    expect(cloudKingdom?.group).toBe('cloud');
    expect(cloudKingdom?.ledgerClean).toBe(false);
  });

  it('produces sorted and unique output when input has duplicates and unsorted order', () => {
    const paths = [
      'public/story-video/luna_start_0.mp4',
      'assets/game/story/luna_start.jpg',
      'public/story-video/luna_start_0.mp4',
      './assets/game/story/luna_start.jpg',
      'assets/game/diff/dog_0.png',
    ];
    const cleanIds = new Set<string>();

    const inventory = buildInventory(paths, cleanIds);

    expect(inventory.map((a) => a.path)).toEqual([
      'assets/game/diff/dog_0.png',
      'assets/game/story/luna_start.jpg',
      'public/story-video/luna_start_0.mp4',
    ]);
  });
});

describe('listMediaFiles', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('returns repo-relative POSIX paths for nested files and ignores directories with no media', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-test-'));

    // Create nested media files in assets/game
    const nestedGameDir = path.join(tempDir, 'assets', 'game', 'musicbox', 'nested', 'deep');
    fs.mkdirSync(nestedGameDir, { recursive: true });
    fs.writeFileSync(path.join(nestedGameDir, 'note.png'), '');

    const storyDir = path.join(tempDir, 'assets', 'game', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    fs.writeFileSync(path.join(storyDir, 'luna_start.jpg'), '');

    // Create an empty directory in assets/game
    const emptyGameDir = path.join(tempDir, 'assets', 'game', 'empty_dir');
    fs.mkdirSync(emptyGameDir, { recursive: true });

    // Create a directory with only non-media files in assets/game
    const textGameDir = path.join(tempDir, 'assets', 'game', 'text_dir');
    fs.mkdirSync(textGameDir, { recursive: true });
    fs.writeFileSync(path.join(textGameDir, 'notes.txt'), 'hello');

    // Create nested media files in public
    const videoDir = path.join(tempDir, 'public', 'story-video');
    fs.mkdirSync(videoDir, { recursive: true });
    fs.writeFileSync(path.join(videoDir, 'luna_start_0.mp4'), '');

    const iconsDir = path.join(tempDir, 'public', 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    fs.writeFileSync(path.join(iconsDir, 'icon.webp'), '');

    // Create a directory with only audio/non-media files in public
    const voiceDir = path.join(tempDir, 'public', 'voice');
    fs.mkdirSync(voiceDir, { recursive: true });
    fs.writeFileSync(path.join(voiceDir, 'speech.mp3'), '');
    fs.writeFileSync(path.join(voiceDir, 'data.json'), '{}');

    // Create an empty directory in public
    const emptyPublicDir = path.join(tempDir, 'public', 'empty_public');
    fs.mkdirSync(emptyPublicDir, { recursive: true });

    // Create media outside assets/game and public (should be ignored)
    const outsideDir = path.join(tempDir, 'docs', 'images');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'diagram.png'), '');

    const result = listMediaFiles(tempDir);

    expect(result).toEqual([
      'assets/game/musicbox/nested/deep/note.png',
      'assets/game/story/luna_start.jpg',
      'public/icons/icon.webp',
      'public/story-video/luna_start_0.mp4',
    ]);
  });

  it('handles a root directory where search subdirectories do not exist', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-empty-'));
    expect(listMediaFiles(tempDir)).toEqual([]);
  });
});

describe('readCleanIds', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('reads tools/quality_ledger.json clean array into a Set', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-ledger-'));
    const toolsDir = path.join(tempDir, 'tools');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.writeFileSync(
      path.join(toolsDir, 'quality_ledger.json'),
      JSON.stringify({
        clean: ['aquarium', 'bakery', 'luna'],
      }),
    );

    const cleanIds = readCleanIds(tempDir);
    expect(cleanIds).toEqual(new Set(['aquarium', 'bakery', 'luna']));
  });

  it('reads the repository clean ids', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const cleanIds = readCleanIds(repoRoot);
    expect(cleanIds.has('aquarium')).toBe(true);
    expect(cleanIds.has('bakery')).toBe(true);
    expect(cleanIds.size).toBeGreaterThan(50);
  });

  it('throws an error if clean array is missing', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-invalid-'));
    const toolsDir = path.join(tempDir, 'tools');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ note: 'no clean array' }));

    expect(() => readCleanIds(tempDir!)).toThrow('Invalid quality ledger: expected clean array');
  });
});
