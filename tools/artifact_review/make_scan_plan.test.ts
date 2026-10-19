import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as child_process from 'node:child_process';
import { getDimensions, main } from './make_scan_plan';
import * as inventory from '../review/inventory';
import * as scanPlan from './scan_plan';

vi.mock('node:child_process');
vi.mock('../review/inventory');
vi.mock('./scan_plan');

describe('make_scan_plan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getDimensions', () => {
    it('parses python output correctly', () => {
      const mockSpawnSync = vi.mocked(child_process.spawnSync);
      const spawnResult: child_process.SpawnSyncReturns<string> = {
        stdout: JSON.stringify({
          'assets/img1.png': { width: 100, height: 200 },
          'assets/img2.jpg': { width: 300, height: 400 },
        }),
        stderr: '',
        status: 0,
        pid: 123,
        signal: null,
        output: [null, '', ''],
        error: undefined,
      };
      mockSpawnSync.mockReturnValue(spawnResult);

      const result = getDimensions(['assets/img1.png', 'assets/img2.jpg']);
      expect(result).toEqual({
        'assets/img1.png': { width: 100, height: 200 },
        'assets/img2.jpg': { width: 300, height: 400 },
      });

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'python3',
        ['-c', expect.any(String)],
        expect.objectContaining({
          input: 'assets/img1.png\nassets/img2.jpg',
        }),
      );
    });

    it('throws error when python script execution fails', () => {
      const mockSpawnSync = vi.mocked(child_process.spawnSync);
      const spawnResult: child_process.SpawnSyncReturns<string> = {
        stdout: '',
        stderr: 'python error',
        status: 1,
        pid: 123,
        signal: null,
        output: [null, '', ''],
        error: undefined,
      };
      mockSpawnSync.mockReturnValue(spawnResult);

      expect(() => getDimensions(['assets/img1.png'])).toThrow('Python script failed with status 1: python error');
    });
  });

  describe('main', () => {
    it('executes the pipeline and writes scan plan', () => {
      const mockReadCleanIds = vi.mocked(inventory.readCleanIds);
      const mockListMediaFiles = vi.mocked(inventory.listMediaFiles);
      const mockBuildInventory = vi.mocked(inventory.buildInventory);
      const mockWriteScanPlan = vi.mocked(scanPlan.writeScanPlan);
      const mockSpawnSync = vi.mocked(child_process.spawnSync);

      mockReadCleanIds.mockReturnValue(new Set(['clean1']));
      mockListMediaFiles.mockReturnValue(['img.png', 'vid.mp4']);
      mockBuildInventory.mockReturnValue([
        {
          path: 'img.png',
          kind: 'image',
          game: '',
          group: '',
          ledgerClean: false,
        },
        {
          path: 'vid.mp4',
          kind: 'video',
          game: '',
          group: '',
          ledgerClean: false,
        },
      ]);

      const spawnResult: child_process.SpawnSyncReturns<string> = {
        stdout: JSON.stringify({
          'img.png': { width: 800, height: 600 },
        }),
        stderr: '',
        status: 0,
        pid: 123,
        signal: null,
        output: [null, '', ''],
        error: undefined,
      };
      mockSpawnSync.mockReturnValue(spawnResult);

      mockWriteScanPlan.mockReturnValue('/fake/path/scan_plan.json');

      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      const code = main('/fake/root');
      expect(code).toBe(0);

      expect(mockBuildInventory).toHaveBeenCalledWith(['img.png', 'vid.mp4'], new Set(['clean1']));
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'python3',
        ['-c', expect.any(String)],
        expect.objectContaining({
          input: 'img.png',
          cwd: '/fake/root',
        }),
      );
      expect(mockWriteScanPlan).toHaveBeenCalledWith(
        [{ path: 'img.png', kind: 'image', width: 800, height: 600 }],
        'scan_plan.json',
        32,
        '/fake/root',
      );

      consoleLog.mockRestore();
    });

    it('returns 1 and logs error on exception', () => {
      const mockReadCleanIds = vi.mocked(inventory.readCleanIds);
      mockReadCleanIds.mockImplementation(() => {
        throw new Error('Test error');
      });

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const code = main('/fake/root');
      expect(code).toBe(1);
      expect(consoleError).toHaveBeenCalledWith('Error: Test error');

      consoleError.mockRestore();
    });
    it('returns 1 and logs error when an asset is missing dimensions', () => {
      const mockReadCleanIds = vi.mocked(inventory.readCleanIds);
      const mockListMediaFiles = vi.mocked(inventory.listMediaFiles);
      const mockBuildInventory = vi.mocked(inventory.buildInventory);
      const mockSpawnSync = vi.mocked(child_process.spawnSync);

      mockReadCleanIds.mockReturnValue(new Set(['clean1']));
      mockListMediaFiles.mockReturnValue(['img1.png', 'img2.png']);
      mockBuildInventory.mockReturnValue([
        {
          path: 'img1.png',
          kind: 'image',
          game: '',
          group: '',
          ledgerClean: false,
        },
        {
          path: 'img2.png',
          kind: 'image',
          game: '',
          group: '',
          ledgerClean: false,
        },
      ]);

      const spawnResult: child_process.SpawnSyncReturns<string> = {
        stdout: JSON.stringify({
          'img1.png': { width: 800, height: 600 },
          // img2.png omitted
        }),
        stderr: '',
        status: 0,
        pid: 123,
        signal: null,
        output: [null, '', ''],
        error: undefined,
      };
      mockSpawnSync.mockReturnValue(spawnResult);

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const code = main('/fake/root');
      expect(code).toBe(1);
      expect(consoleError).toHaveBeenCalledWith('Error: No dimensions returned for img2.png');

      consoleError.mockRestore();
    });
  });
});
