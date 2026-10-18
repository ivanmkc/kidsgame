import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MediaAsset {
  path: string;
  kind: 'image' | 'video';
  game: string;
  group: string;
  ledgerClean: boolean;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);
const SEARCH_ROOTS = ['assets/game', 'public'] as const;

function getMediaKind(ext: string): 'image' | 'video' | null {
  if (IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }
  return null;
}

function extractGame(normPath: string): string {
  if (normPath.startsWith('assets/game/')) {
    const rest = normPath.slice('assets/game/'.length);
    const slashIdx = rest.indexOf('/');
    return slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
  }
  if (normPath.startsWith('public/')) {
    const rest = normPath.slice('public/'.length);
    const slashIdx = rest.indexOf('/');
    return slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
  }
  const parts = normPath.split('/');
  return parts.length > 1 ? parts[0] : '';
}

function extractGroupAndClean(
  normPath: string,
  ext: string,
  cleanIds: ReadonlySet<string>,
): { group: string; ledgerClean: boolean } {
  const filename = path.posix.basename(normPath);
  const stem = filename.slice(0, -ext.length);

  let longestMatch: string | null = null;
  for (const id of cleanIds) {
    if (stem === id || stem.startsWith(id + '_')) {
      if (!longestMatch || id.length > longestMatch.length) {
        longestMatch = id;
      }
    }
  }

  if (longestMatch !== null) {
    return { group: longestMatch, ledgerClean: true };
  }

  const underscoreIdx = stem.indexOf('_');
  const fallbackGroup = underscoreIdx !== -1 ? stem.slice(0, underscoreIdx) : stem;
  return { group: fallbackGroup, ledgerClean: false };
}

export function buildInventory(paths: readonly string[], cleanIds: ReadonlySet<string>): MediaAsset[] {
  const seen = new Set<string>();
  const assets: MediaAsset[] = [];

  for (const rawPath of paths) {
    const normPath = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    if (seen.has(normPath)) {
      continue;
    }
    const ext = path.posix.extname(normPath).toLowerCase();
    const kind = getMediaKind(ext);
    if (!kind) {
      continue;
    }
    seen.add(normPath);

    const game = extractGame(normPath);
    const { group, ledgerClean } = extractGroupAndClean(normPath, ext, cleanIds);

    assets.push({
      path: normPath,
      kind,
      game,
      group,
      ledgerClean,
    });
  }

  assets.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return assets;
}

export function listMediaFiles(root: string): string[] {
  const mediaFiles: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
          const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
          mediaFiles.push(relPath);
        }
      }
    }
  }

  for (const sub of SEARCH_ROOTS) {
    const subDir = path.join(root, sub);
    if (fs.existsSync(subDir)) {
      walk(subDir);
    }
  }

  mediaFiles.sort();
  return mediaFiles;
}

export function readCleanIds(root: string): Set<string> {
  const filePath = path.join(root, 'tools/quality_ledger.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as { clean?: unknown };
  if (!Array.isArray(parsed.clean)) {
    throw new Error(`Invalid quality ledger: expected clean array in ${filePath}`);
  }
  return new Set<string>(parsed.clean);
}
