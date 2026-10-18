import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../videoHelper';

describe('videoHelper CLI', () => {
  let tempDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-test-'));
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('outputs public video assets in inventory mode', () => {
    const pub = path.join(tempDir, 'public', 'story-video');
    fs.mkdirSync(pub, { recursive: true });
    fs.writeFileSync(path.join(pub, 'luna_start_0.mp4'), 'dummy');
    fs.writeFileSync(path.join(pub, 'readme.txt'), 'text');

    const toolsDir = path.join(tempDir, 'tools');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: ['luna'] }));

    main(['inventory', tempDir]);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([
      {
        path: 'public/story-video/luna_start_0.mp4',
        kind: 'video',
        game: 'story-video',
        group: 'luna',
        ledgerClean: true,
      },
    ]);
  });

  it('outputs frames and ffmpeg select expression in select-frames mode from argv', () => {
    main(['select-frames', JSON.stringify({ frameCount: 120, fps: 30 })]);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      frames: [0, 60, 119],
      expr: 'eq(n\\,0)+eq(n\\,60)+eq(n\\,119)',
    });
  });

  it('outputs frames and ffmpeg select expression in select-frames mode from stdin', () => {
    main(['select-frames'], () => JSON.stringify({ frameCount: 60, fps: 30 }));
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      frames: [0, 30, 59],
      expr: 'eq(n\\,0)+eq(n\\,30)+eq(n\\,59)',
    });
  });

  it('throws on unknown command or missing options', () => {
    expect(() => main(['unknown'])).toThrow('Unknown command: unknown');
    expect(() => main(['select-frames'], () => '')).toThrow(
      'select-frames requires JSON options argument or stdin payload',
    );
  });
});
