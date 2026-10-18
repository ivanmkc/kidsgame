import * as path from 'node:path';
import { type RegenJob } from './regen_queue';

export interface GenerateImageRequest {
  model: string;
  prompt: string;
  referenceImage?: Uint8Array;
  mimeType: string;
}

export interface ImageModelClient {
  generateImage(req: GenerateImageRequest): Promise<Uint8Array>;
}

export interface RunnerIo {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
}

export type CandidateStatus = 'success' | 'skipped' | 'error';

export interface CandidateEntry {
  assetPath: string;
  candidatePath: string | null;
  model: string;
  status: CandidateStatus;
  reason?: string;
}

export type CandidateManifest = CandidateEntry[];

export interface RunImageRegenerationDeps {
  client: ImageModelClient;
  io: RunnerIo;
  candidatesDir: string;
  promptFor(job: RegenJob): string | null;
}

export interface PathValidationResult {
  safe: boolean;
  error?: string;
  candidatePath?: string;
}

export function mimeTypeFor(assetPath: string): string {
  const lower = assetPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export function validateCandidatePath(candidatesDir: string, assetPath: string): PathValidationResult {
  if (!assetPath || assetPath.trim() === '') {
    return { safe: false, error: 'Asset path cannot be empty' };
  }
  if (!candidatesDir || candidatesDir.trim() === '') {
    return { safe: false, error: 'Candidates directory cannot be empty' };
  }

  const resolvedCandidatesDir = path.resolve(candidatesDir);
  const resolvedCandidatePath = path.resolve(resolvedCandidatesDir, assetPath);
  const relative = path.relative(resolvedCandidatesDir, resolvedCandidatePath);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      safe: false,
      error: `Asset path escapes candidates directory: ${assetPath}`,
    };
  }

  const resolvedAssetPath = path.resolve(assetPath);
  if (resolvedCandidatePath === resolvedAssetPath) {
    return {
      safe: false,
      error: `Candidate path cannot overwrite shipped asset: ${assetPath}`,
    };
  }

  const candidatePath = path.join(candidatesDir, assetPath).replace(/\\/g, '/');
  return { safe: true, candidatePath };
}

export async function runImageRegeneration(
  jobs: readonly RegenJob[],
  deps: RunImageRegenerationDeps,
): Promise<CandidateManifest> {
  const manifest: CandidateEntry[] = [];

  for (const job of jobs) {
    const model = job.model;

    if (job.mediaKind !== 'image') {
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'skipped',
        reason: 'Video jobs belong to R6',
      });
      continue;
    }

    if (!job.generator || job.generator.trim() === '') {
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'skipped',
        reason: 'No known generator for asset',
      });
      continue;
    }

    const prompt = deps.promptFor(job)?.trim();
    if (!prompt) {
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'skipped',
        reason: 'No prompt for asset',
      });
      continue;
    }

    const pathValidation = validateCandidatePath(deps.candidatesDir, job.asset);
    if (!pathValidation.safe || !pathValidation.candidatePath) {
      const errorMsg = pathValidation.error ?? 'Invalid candidate path';
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'error',
        reason: errorMsg,
      });
      continue;
    }

    let referenceImage: Uint8Array;
    try {
      referenceImage = await deps.io.readFile(job.asset);
    } catch (err) {
      const reason = `Failed to read reference asset: ${err instanceof Error ? err.message : String(err)}`;
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'error',
        reason,
      });
      continue;
    }

    const mimeType = mimeTypeFor(job.asset);

    let generatedBytes: Uint8Array;
    try {
      generatedBytes = await deps.client.generateImage({
        model,
        prompt,
        referenceImage,
        mimeType,
      });
    } catch (err) {
      const reason = `Model generation failed: ${err instanceof Error ? err.message : String(err)}`;
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'error',
        reason,
      });
      continue;
    }

    try {
      await deps.io.writeFile(pathValidation.candidatePath, generatedBytes);
      manifest.push({
        assetPath: job.asset,
        candidatePath: pathValidation.candidatePath,
        model,
        status: 'success',
      });
    } catch (err) {
      const reason = `Failed to write candidate asset: ${err instanceof Error ? err.message : String(err)}`;
      manifest.push({
        assetPath: job.asset,
        candidatePath: null,
        model,
        status: 'error',
        reason,
      });
    }
  }

  const manifestPath = path.join(deps.candidatesDir, 'candidates.json').replace(/\\/g, '/');
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n');
  await deps.io.writeFile(manifestPath, manifestBytes);

  return manifest;
}
