import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CompressOptions {
  maxAttempts?: number;
  minQuality?: number;
}

function runCmd(cmd: string, args: readonly string[]): { status: number; stdout: string; stderr: string } {
  const r = child_process.spawnSync(cmd, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (r.error) throw r.error;
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export function compressImageToBudget(candidatePath: string, targetSize: number, options: CompressOptions = {}): void {
  const maxAttempts = options.maxAttempts ?? 10;
  const minQuality = options.minQuality ?? 10;

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Candidate file not found: ${candidatePath}`);
  }

  const currentSize = fs.statSync(candidatePath).size;
  if (currentSize <= targetSize) {
    return;
  }

  const ext = path.extname(candidatePath).toLowerCase();
  const isJpeg = ext === '.jpg' || ext === '.jpeg';
  const isPng = ext === '.png';

  if (!isJpeg && !isPng) {
    throw new Error(`Unsupported image format for budget compression: ${ext}`);
  }

  const scriptPath = path.join(__dirname, 'compress_image.py');
  const res = runCmd('python3', [
    scriptPath,
    candidatePath,
    String(targetSize),
    String(maxAttempts),
    String(minQuality),
  ]);
  if (res.status !== 0) {
    throw new Error(`Image compression script failed with status ${res.status}:\n${res.stderr}`);
  }
}

export function compressVideoToBudget(candidatePath: string, targetSize: number, options: CompressOptions = {}): void {
  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Candidate file not found: ${candidatePath}`);
  }

  const currentSize = fs.statSync(candidatePath).size;
  if (currentSize <= targetSize) {
    return;
  }

  const ext = path.extname(candidatePath).toLowerCase();
  const isOgv = ext === '.ogv';

  const steps = isOgv ? ['7', '6', '5', '4', '3', '2', '1'] : ['28', '32', '36', '40', '44', '48', '51'];
  const maxSteps = options.maxAttempts ?? steps.length;
  const stepsToTry = steps.slice(0, maxSteps);

  const tempOutput = (ext ? candidatePath.slice(0, -ext.length) : candidatePath) + `_compressed${ext}`;

  try {
    for (const stepVal of stepsToTry) {
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
      }
      const args = isOgv
        ? ['-y', '-i', candidatePath, '-q:v', stepVal, tempOutput]
        : ['-y', '-i', candidatePath, '-crf', stepVal, '-preset', 'fast', tempOutput];

      const res = runCmd('ffmpeg', args);
      if (res.status !== 0) {
        throw new Error(`ffmpeg failed with status ${res.status}:\n${res.stderr}`);
      }
      if (fs.existsSync(tempOutput)) {
        const newSize = fs.statSync(tempOutput).size;
        if (newSize <= targetSize) {
          fs.copyFileSync(tempOutput, candidatePath);
          fs.unlinkSync(tempOutput);
          return;
        }
      }
    }

    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }

    const finalSize = fs.statSync(candidatePath).size;
    if (finalSize > targetSize) {
      throw new Error(`Failed to compress video to target size ${targetSize} bytes (final size: ${finalSize} bytes)`);
    }
  } finally {
    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }
  }
}

export function compressToBudget(candidatePath: string, targetSize: number, options: CompressOptions = {}): void {
  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Candidate file not found: ${candidatePath}`);
  }
  const candidateSize = fs.statSync(candidatePath).size;
  if (candidateSize <= targetSize) {
    return;
  }

  const ext = path.extname(candidatePath).toLowerCase();
  const isVideo = ['.mp4', '.ogv', '.webm', '.mov', '.m4v'].includes(ext);

  if (isVideo) {
    compressVideoToBudget(candidatePath, targetSize, options);
  } else {
    compressImageToBudget(candidatePath, targetSize, options);
  }
}
