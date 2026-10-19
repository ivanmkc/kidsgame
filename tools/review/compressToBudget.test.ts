import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as child_process from 'node:child_process';
import { compressToBudget } from './compressToBudget';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn(),
  };
});

describe('compressToBudget', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does nothing if candidate is already smaller than or equal to target', () => {
    const candPath = path.join(tmpDir, 'cand.jpg');
    fs.writeFileSync(candPath, Buffer.alloc(500));

    compressToBudget(candPath, 1000);
    expect(fs.statSync(candPath).size).toBe(500);
    expect(child_process.spawnSync).not.toHaveBeenCalled();
  });

  it('throws error if candidate does not exist', () => {
    const candPath = path.join(tmpDir, 'nonexistent_cand.jpg');

    expect(() => compressToBudget(candPath, 1000)).toThrow(/Candidate file not found/);
  });

  it('throws error for unsupported image formats', () => {
    const candPath = path.join(tmpDir, 'cand.webp');
    fs.writeFileSync(candPath, Buffer.alloc(2000));

    expect(() => compressToBudget(candPath, 1000)).toThrow(/Unsupported image format/);
  });

  it('verifies budget checks and compression iteration logic with mocked exec outputs for video', () => {
    const candPath = path.join(tmpDir, 'cand.mp4');
    fs.writeFileSync(candPath, Buffer.alloc(5000));

    let callCount = 0;
    let usedCrfValues: string[] = [];
    vi.mocked(child_process.spawnSync).mockImplementation((_cmd, args) => {
      callCount++;
      const actualArgs = args ?? [];
      const crfIdx = actualArgs.indexOf('-crf');
      if (crfIdx !== -1 && actualArgs[crfIdx + 1]) {
        usedCrfValues.push(actualArgs[crfIdx + 1]!);
      }
      const outArg = actualArgs[actualArgs.length - 1];
      if (typeof outArg === 'string') {
        if (callCount === 1) {
          fs.writeFileSync(outArg, Buffer.alloc(1200));
        } else {
          fs.writeFileSync(outArg, Buffer.alloc(800));
        }
      }
      return { status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null };
    });

    compressToBudget(candPath, 1000);
    expect(fs.statSync(candPath).size).toBe(800);
    expect(callCount).toBe(2);
    expect(usedCrfValues).toEqual(['28', '32']);
    expect(child_process.spawnSync).toHaveBeenCalled();
  });

  it('verifies budget checks, argument passing, and failure handling for image compression script', () => {
    const candPath = path.join(tmpDir, 'cand.jpg');
    fs.writeFileSync(candPath, Buffer.alloc(2000));

    let capturedArgs: readonly string[] | undefined;
    vi.mocked(child_process.spawnSync).mockImplementation((cmd, args) => {
      if (cmd === 'python3') {
        capturedArgs = args;
        fs.writeFileSync(candPath, Buffer.alloc(900));
        return { status: 0, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null };
      }
      return { status: 1, stdout: '', stderr: '', pid: 1, output: ['', '', ''], signal: null };
    });

    compressToBudget(candPath, 1000);
    expect(fs.statSync(candPath).size).toBe(900);
    expect(capturedArgs).toBeDefined();
    expect(capturedArgs![0]).toContain('compress_image.py');
    expect(capturedArgs![1]).toBe(candPath);
    expect(capturedArgs![2]).toBe('1000');

    // Test that non-zero exit throws error
    vi.mocked(child_process.spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: '',
      stderr: 'PIL missing',
      pid: 1,
      output: ['', '', ''],
      signal: null,
    });
    const candPath2 = path.join(tmpDir, 'cand2.jpg');
    fs.writeFileSync(candPath2, Buffer.alloc(2000));
    expect(() => compressToBudget(candPath2, 1000)).toThrow(/Image compression script failed/);
  });
});
