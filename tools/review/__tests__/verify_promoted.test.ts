import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../verify_promoted';

vi.mock('node:child_process');
vi.mock('node:fs');

describe('verifyPromoted', () => {
  const rootDir = '/mock/root';
  let spawnSyncMock: ReturnType<typeof vi.fn>;
  let readFileSyncMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    spawnSyncMock = vi.spyOn(childProcess, 'spawnSync').mockReturnValue({
      pid: 1,
      output: [null, '', ''],
      stdout: '',
      stderr: '',
      status: 0,
      signal: null,
    });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

    readFileSyncMock = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      const p = filePath.toString().replace(/\\/g, '/');
      if (p.endsWith('review_decisions.json')) {
        return JSON.stringify([
          { path: 'assets/game/bg.png', verdict: 'accept' },
          { path: 'assets/game/reject.png', verdict: 'reject' },
        ]);
      }
      if (p.endsWith('/video_artifact_report.json')) {
        return JSON.stringify([]);
      }
      if (p.endsWith('/artifact_report.json')) {
        return JSON.stringify([]);
      }
      return '';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs tools successfully when there are no findings', () => {
    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).not.toThrow();

    expect(spawnSyncMock).toHaveBeenCalledWith(
      'python3',
      ['tools/artifact_scan.py', '--out', 'tools/audit_out/artifact_scan'],
      expect.anything(),
    );
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'python3',
      ['tools/video_artifact_scan.py', '--output', 'tools/audit_out/video_artifact_scan/video_artifact_report.json'],
      expect.anything(),
    );
    expect(spawnSyncMock).toHaveBeenCalledWith('npx', ['vitest', 'run', '--passWithNoTests'], expect.anything());
    expect(spawnSyncMock).toHaveBeenCalledWith('npx', ['tsc', '--noEmit'], expect.anything());
  });

  it('throws an error if an accepted asset has findings', () => {
    readFileSyncMock.mockImplementation((filePath) => {
      const p = filePath.toString().replace(/\\/g, '/');
      if (p.endsWith('review_decisions.json')) {
        return JSON.stringify([{ path: 'assets/game/bg.png', verdict: 'accept' }]);
      }
      if (p.endsWith('/video_artifact_report.json')) {
        return JSON.stringify([]);
      }
      if (p.endsWith('/artifact_report.json')) {
        return JSON.stringify([{ asset: 'assets/game/bg.png', kind: 'judged-artifact', severity: 2 }]);
      }
      return '';
    });

    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).toThrow(
      /Re-scan detected findings on accepted assets.*assets\/game\/bg\.png/s,
    );
  });

  it('resolves and still spawns tools if scan report flags only a rejected/undecided asset', () => {
    readFileSyncMock.mockImplementation((filePath) => {
      const p = filePath.toString().replace(/\\/g, '/');
      if (p.endsWith('review_decisions.json')) {
        return JSON.stringify([
          { path: 'assets/game/bg.png', verdict: 'accept' },
          { path: 'assets/game/reject.png', verdict: 'reject' },
        ]);
      }
      if (p.endsWith('/video_artifact_report.json')) {
        return JSON.stringify([]);
      }
      if (p.endsWith('/artifact_report.json')) {
        return JSON.stringify([{ asset: 'assets/game/reject.png', kind: 'judged-artifact', severity: 2 }]);
      }
      return '';
    });

    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).not.toThrow();
    expect(spawnSyncMock).toHaveBeenCalledWith('npx', ['vitest', 'run', '--passWithNoTests'], expect.anything());
    expect(spawnSyncMock).toHaveBeenCalledWith('npx', ['tsc', '--noEmit'], expect.anything());
  });

  it('throws an error if an accepted video has findings', () => {
    readFileSyncMock.mockImplementation((filePath) => {
      const p = filePath.toString().replace(/\\/g, '/');
      if (p.endsWith('review_decisions.json')) {
        return JSON.stringify([{ path: 'public/story-video/clip.mp4', verdict: 'accept' }]);
      }
      if (p.endsWith('/video_artifact_report.json')) {
        return JSON.stringify([
          { class: 'seam', owning_asset: 'public/story-video/clip.mp4', severity: 2, where: 'f3', description: 'tear' },
        ]);
      }
      if (p.endsWith('/artifact_report.json')) {
        return JSON.stringify([]);
      }
      return '';
    });

    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).toThrow(
      /Re-scan detected findings on accepted assets.*public\/story-video\/clip\.mp4/s,
    );
  });

  it('does not throw if a non-accepted video has findings', () => {
    readFileSyncMock.mockImplementation((filePath) => {
      const p = filePath.toString().replace(/\\/g, '/');
      if (p.endsWith('review_decisions.json')) {
        return JSON.stringify([{ path: 'public/story-video/clip.mp4', verdict: 'reject' }]);
      }
      if (p.endsWith('/video_artifact_report.json')) {
        return JSON.stringify([
          { class: 'seam', owning_asset: 'public/story-video/clip.mp4', severity: 2, where: 'f3', description: 'tear' },
        ]);
      }
      if (p.endsWith('/artifact_report.json')) {
        return JSON.stringify([]);
      }
      return '';
    });

    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).not.toThrow();
  });

  it('throws an error if vitest or tsc fails', () => {
    spawnSyncMock.mockImplementation((cmd, args) => {
      if (cmd === 'npx' && args && args[0] === 'tsc') {
        return {
          pid: 1,
          output: [null, 'tsc err', ''],
          stdout: 'tsc err',
          stderr: '',
          status: 1,
          signal: null,
        };
      }
      return {
        pid: 1,
        output: [null, '', ''],
        stdout: '',
        stderr: '',
        status: 0,
        signal: null,
      };
    });

    expect(() => main(['--decisions', 'review_decisions.json'], rootDir)).toThrow(/Step failed/);
  });
});
