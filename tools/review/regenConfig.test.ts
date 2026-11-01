import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { generatorFor, REGEN_MODELS, storyIdFromVideo } from './regenConfig';

describe('REGEN_MODELS', () => {
  test('defines SoTA model ids for image and video', () => {
    expect(REGEN_MODELS.image).toBe('gemini-nano-banana-2.1');
    expect(REGEN_MODELS.video).toBe('veo-3.1-fast-generate-001');
  });

  test('REGEN_MODELS.image equals NBP_MODEL in tools/gen/nbp.py', () => {
    const nbpPath = path.resolve(process.cwd(), 'tools/gen/nbp.py');
    const nbpSource = fs.readFileSync(nbpPath, 'utf-8');
    const match = nbpSource.match(/NBP_MODEL\s*=\s*\([^,]+,\s*["']([^"']+)["']/);
    expect(match).not.toBeNull();
    expect(REGEN_MODELS.image).toBe(match![1]);
  });
});

describe('storyIdFromVideo', () => {
  test('extracts story id from a standard video filename', () => {
    expect(storyIdFromVideo('luna_start_0.mp4')).toBe('luna');
    expect(storyIdFromVideo('public/story-video/luna_start_0.mp4')).toBe('luna');
  });

  test('extracts story id from a filename with an underscore in the node id', () => {
    expect(storyIdFromVideo('acorn_end_cozy_burrow.mp4')).toBe('acorn');
    expect(storyIdFromVideo('acorn_end_cozy_burrow_end.mp4')).toBe('acorn');
    expect(storyIdFromVideo('public/story-video/acorn_end_cozy_burrow.mp4')).toBe('acorn');
    expect(storyIdFromVideo('public/story-video/acorn_end_cozy_burrow_end.mp4')).toBe('acorn');
  });

  test('extracts story id from scare and numbered node videos', () => {
    expect(storyIdFromVideo('acorn_aa_scare.mp4')).toBe('acorn');
    expect(storyIdFromVideo('acorn_a_0.mp4')).toBe('acorn');
  });

  test('returns null for filenames without an underscore or with empty story id', () => {
    expect(storyIdFromVideo('novideo.mp4')).toBeNull();
    expect(storyIdFromVideo('_invalid_node_0.mp4')).toBeNull();
  });
});

describe('generatorFor', () => {
  test('Rule 1: public/story-video/<sid>_<nid>_<n>.mp4 -> tools/gen_story_videos.py [sid]', () => {
    expect(generatorFor('public/story-video/luna_start_0.mp4')).toEqual({
      script: 'tools/gen_story_videos.py',
      args: ['luna'],
      model: 'video',
    });
    // Video filename with an underscore in the node id:
    expect(generatorFor('public/story-video/acorn_end_cozy_burrow.mp4')).toEqual({
      script: 'tools/gen_story_videos.py',
      args: ['acorn'],
      model: 'video',
    });
    expect(generatorFor('public/story-video/acorn_end_cozy_burrow_end.mp4')).toEqual({
      script: 'tools/gen_story_videos.py',
      args: ['acorn'],
      model: 'video',
    });
  });

  test('Rule 2: assets/game/story/* -> tools/gen_stories.py [story id]', () => {
    expect(generatorFor('assets/game/story/acorn_a.jpg')).toEqual({
      script: 'tools/gen_stories.py',
      args: ['acorn'],
      model: 'image',
    });
    expect(generatorFor('assets/game/story/acorn_end_cozy_burrow.jpg')).toEqual({
      script: 'tools/gen_stories.py',
      args: ['acorn'],
      model: 'image',
    });
    expect(generatorFor('assets/game/story/luna/start.png')).toEqual({
      script: 'tools/gen_stories.py',
      args: ['luna'],
      model: 'image',
    });
  });

  test('Rule 3: assets/game/escape/<room>/ -> tools/gen_escape.py [room] with positional args', () => {
    expect(generatorFor('assets/game/escape/toyroom/')).toEqual({
      script: 'tools/gen_escape.py',
      args: ['toyroom'],
      model: 'image',
    });
    expect(generatorFor('assets/game/escape/toyroom_clean.png')).toEqual({
      script: 'tools/gen_escape.py',
      args: ['toyroom'],
      model: 'image',
    });
    expect(generatorFor('assets/game/escape/dragoncave/dragon.webp')).toEqual({
      script: 'tools/gen_escape.py',
      args: ['dragoncave'],
      model: 'image',
    });
  });

  test('Rule 4: assets/game/musicbox/<scene>/ -> tools/gen_musicbox_scene.py [scene] with positional args', () => {
    expect(generatorFor('assets/game/musicbox/twinkle/')).toEqual({
      script: 'tools/gen_musicbox_scene.py',
      args: ['twinkle'],
      model: 'image',
    });
    expect(generatorFor('assets/game/musicbox/twinkle/bg.png')).toEqual({
      script: 'tools/gen_musicbox_scene.py',
      args: ['twinkle'],
      model: 'image',
    });
    expect(generatorFor('assets/game/musicbox/row_clean.png')).toEqual({
      script: 'tools/gen_musicbox_scene.py',
      args: ['row'],
      model: 'image',
    });
  });

  test('Rule 5: assets/game/dressup -> tools/gen_dressup.py', () => {
    expect(generatorFor('assets/game/dressup')).toEqual({
      script: 'tools/gen_dressup.py',
      args: [],
      model: 'image',
    });
    expect(generatorFor('assets/game/dressup/crown.png')).toEqual({
      script: 'tools/gen_dressup.py',
      args: [],
      model: 'image',
    });
  });

  test('Rule 6: assets/game/{spotit,diff,hidden,ui} -> tools/generate_assets.py [--only, <kind>]', () => {
    expect(generatorFor('assets/game/spotit/star.png')).toEqual({
      script: 'tools/generate_assets.py',
      args: ['--only', 'icons'],
      model: 'image',
    });
    expect(generatorFor('assets/game/diff/farm_base.png')).toEqual({
      script: 'tools/generate_assets.py',
      args: ['--only', 'diff'],
      model: 'image',
    });
    expect(generatorFor('assets/game/hidden/beach.png')).toEqual({
      script: 'tools/generate_assets.py',
      args: ['--only', 'hidden'],
      model: 'image',
    });
    expect(generatorFor('assets/game/ui/logo.png')).toEqual({
      script: 'tools/generate_assets.py',
      args: ['--only', 'ui'],
      model: 'image',
    });
  });

  test('returns null for unknown paths or unsupported categories', () => {
    expect(generatorFor('assets/game/animals/cat.png')).toBeNull();
    expect(generatorFor('assets/game/characters/hero.png')).toBeNull();
    expect(generatorFor('assets/game/rhyme/fox.png')).toBeNull();
    expect(generatorFor('public/story-video/non-video.txt')).toBeNull();
    expect(generatorFor('public/story-video/_invalid.mp4')).toBeNull();
    expect(generatorFor('assets/game/story/')).toBeNull();
    expect(generatorFor('assets/game/escape/')).toBeNull();
    expect(generatorFor('assets/game/musicbox/')).toBeNull();
    expect(generatorFor('src/index.ts')).toBeNull();
    expect(generatorFor('unknown/path')).toBeNull();
    expect(generatorFor('')).toBeNull();
  });

  test('handles path normalization with leading ./, /, and backslashes', () => {
    expect(generatorFor('./assets/game/dressup/crown.png')).toEqual({
      script: 'tools/gen_dressup.py',
      args: [],
      model: 'image',
    });
    expect(generatorFor('/assets/game/story/acorn_a.jpg')).toEqual({
      script: 'tools/gen_stories.py',
      args: ['acorn'],
      model: 'image',
    });
    expect(generatorFor('assets\\game\\escape\\toyroom\\')).toEqual({
      script: 'tools/gen_escape.py',
      args: ['toyroom'],
      model: 'image',
    });
    expect(storyIdFromVideo('public\\story-video\\acorn_end_cozy_burrow.mp4')).toBe('acorn');
  });

  test('handles exact room and scene directories without trailing slashes', () => {
    expect(generatorFor('assets/game/escape/toyroom')).toEqual({
      script: 'tools/gen_escape.py',
      args: ['toyroom'],
      model: 'image',
    });
    expect(generatorFor('assets/game/musicbox/twinkle')).toEqual({
      script: 'tools/gen_musicbox_scene.py',
      args: ['twinkle'],
      model: 'image',
    });
    expect(generatorFor('assets/game/story/acorn.png')).toEqual({
      script: 'tools/gen_stories.py',
      args: ['acorn'],
      model: 'image',
    });
    expect(generatorFor('assets/game/escape')).toBeNull();
    expect(generatorFor('assets/game/musicbox')).toBeNull();
    expect(generatorFor('assets/game/story/_.png')).toBeNull();
  });
});
