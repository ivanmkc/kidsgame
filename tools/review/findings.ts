import type { MediaAsset } from './inventory';

export interface ReviewFinding {
  source: 'scan' | 'loop' | 'video';
  category: string;
  severity: 1 | 2 | 3;
  assetPath: string | null;
  dirPath: string | null;
  surface: string | null;
  rect: [number, number, number, number] | null;
  evidence: string | null;
  note: string;
}

export interface ReviewEntry {
  asset: MediaAsset;
  findings: ReviewFinding[];
  maxSeverity: 0 | 1 | 2 | 3;
  candidatePath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prefixAssetPath(rawPath: string): string {
  const norm = rawPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  return norm.startsWith('assets/game/') || norm.startsWith('public/')
    ? norm
    : `assets/game/${norm}`;
}

function parseRect(val: unknown): [number, number, number, number] | null {
  if (Array.isArray(val) && val.length === 4 && val.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return [val[0], val[1], val[2], val[3]];
  }
  return null;
}

function clampSeverity(val: unknown): 1 | 2 | 3 {
  const num = typeof val === 'number' ? val : typeof val === 'string' ? Number(val) : 1;
  const rounded = Number.isFinite(num) ? Math.round(num) : 1;
  if (rounded <= 1) return 1;
  if (rounded >= 3) return 3;
  return 2;
}

export function parseScanReport(json: unknown): { findings: ReviewFinding[]; rejected: number } {
  if (!Array.isArray(json)) {
    return { findings: [], rejected: 1 };
  }
  const findings: ReviewFinding[] = [];
  let rejected = 0;

  for (const item of json) {
    if (
      !isRecord(item) ||
      typeof item.asset !== 'string' ||
      item.asset.trim() === '' ||
      typeof item.kind !== 'string' ||
      item.kind.trim() === ''
    ) {
      rejected++;
      continue;
    }

    const kind = item.kind.trim();
    const severity: 1 | 2 | 3 =
      kind === 'pair-identity' ? 3 : kind === 'judged-artifact' ? 2 : clampSeverity(item.severity);
    const assetPath = prefixAssetPath(item.asset.trim());
    const rect = parseRect(item.rect);
    const evidence = typeof item.crop === 'string' && item.crop.trim() !== '' ? item.crop.trim() : null;
    const note = typeof item.detail === 'string' ? item.detail : '';

    findings.push({
      source: 'scan',
      category: kind,
      severity,
      assetPath,
      dirPath: null,
      surface: null,
      rect,
      evidence,
      note,
    });
  }
  return { findings, rejected };
}

export function parseLoopFindings(json: unknown): { findings: ReviewFinding[]; rejected: number } {
  if (!Array.isArray(json)) {
    return { findings: [], rejected: 1 };
  }
  const findings: ReviewFinding[] = [];
  let rejected = 0;

  for (const item of json) {
    if (!isRecord(item) || typeof item.class !== 'string' || item.class.trim() === '') {
      rejected++;
      continue;
    }

    const category = item.class.trim();
    const severity = clampSeverity(item.severity);
    const dirPath =
      typeof item.owning_asset === 'string' && item.owning_asset.trim() !== '' ? item.owning_asset.trim() : null;
    const surface = typeof item.surface === 'string' && item.surface.trim() !== '' ? item.surface.trim() : null;
    const evidence =
      typeof item.screenshot === 'string' && item.screenshot.trim() !== '' ? item.screenshot.trim() : null;
    const where = typeof item.where === 'string' ? item.where : '';
    const description = typeof item.description === 'string' ? item.description : '';
    const note = `${where}: ${description}`;

    findings.push({
      source: 'loop',
      category,
      severity,
      assetPath: null,
      dirPath,
      surface,
      rect: null,
      evidence,
      note,
    });
  }
  return { findings, rejected };
}

export function attachFindings(
  assets: readonly MediaAsset[],
  findings: readonly ReviewFinding[],
): {
  entries: ReviewEntry[];
  dirFindings: ReviewFinding[];
  unmatched: ReviewFinding[];
} {
  const entryMap = new Map<string, ReviewEntry>();
  const entries: ReviewEntry[] = [];

  for (const asset of assets) {
    const entry: ReviewEntry = {
      asset,
      findings: [],
      maxSeverity: 0,
    };
    entries.push(entry);
    entryMap.set(asset.path, entry);
  }

  const dirFindings: ReviewFinding[] = [];
  const unmatched: ReviewFinding[] = [];

  for (const finding of findings) {
    if (finding.assetPath !== null) {
      const entry = entryMap.get(finding.assetPath);
      if (entry) {
        entry.findings.push(finding);
        if (finding.severity > entry.maxSeverity) {
          entry.maxSeverity = finding.severity;
        }
      } else {
        unmatched.push(finding);
      }
    } else if (finding.dirPath !== null) {
      dirFindings.push(finding);
    } else {
      unmatched.push(finding);
    }
  }

  entries.sort((a, b) => {
    if (b.maxSeverity !== a.maxSeverity) {
      return b.maxSeverity - a.maxSeverity;
    }
    return a.asset.path < b.asset.path ? -1 : a.asset.path > b.asset.path ? 1 : 0;
  });

  return { entries, dirFindings, unmatched };
}
