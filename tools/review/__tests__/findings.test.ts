import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '../inventory';
import { attachFindings, parseLoopFindings, parseScanReport, type ReviewFinding } from '../findings';

describe('parseScanReport', () => {
  it('parses pair-identity finding with severity 3 and detail as note', () => {
    const raw = [
      {
        asset: 'diff/dog_0.png',
        kind: 'pair-identity',
        detail: '0.250% of out-of-rect pixels differ',
      },
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings).toEqual([
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/diff/dog_0.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '0.250% of out-of-rect pixels differ',
      },
    ]);
  });

  it('parses judged-artifact finding with severity 2, rect and crop as evidence', () => {
    const raw = [
      {
        asset: 'hidden/cat_0.png',
        kind: 'judged-artifact',
        rect: [10, 20, 100, 150],
        crop: 'cat_0_crop.png',
      },
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings).toEqual([
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/hidden/cat_0.png',
        dirPath: null,
        surface: null,
        rect: [10, 20, 100, 150],
        evidence: 'cat_0_crop.png',
        note: '',
      },
    ]);
  });

  it('prefixes asset path properly across relative, leading slash and already prefixed paths', () => {
    const raw = [
      { asset: 'escape/toyroom/bg.png', kind: 'pair-identity' },
      { asset: 'assets/game/escape/toyroom/key.png', kind: 'pair-identity' },
      { asset: '/diff/pair_0.png', kind: 'pair-identity' },
      { asset: './diff/pair_1.png', kind: 'pair-identity' },
      { asset: 'diff\\pair_2.png', kind: 'pair-identity' },
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings.map((f) => f.assetPath)).toEqual([
      'assets/game/escape/toyroom/bg.png',
      'assets/game/escape/toyroom/key.png',
      'assets/game/diff/pair_0.png',
      'assets/game/diff/pair_1.png',
      'assets/game/diff/pair_2.png',
    ]);
  });

  it('handles custom kind with clampable severity or defaults to 1', () => {
    const raw = [
      { asset: 'diff/custom.png', kind: 'other-issue', severity: 3 },
      { asset: 'diff/custom2.png', kind: 'other-issue' },
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings[0].severity).toBe(3);
    expect(result.findings[1].severity).toBe(1);
  });

  it('handles invalid rects by setting rect to null', () => {
    const raw = [
      { asset: 'diff/a.png', kind: 'judged-artifact', rect: [1, 2, 3] },
      { asset: 'diff/b.png', kind: 'judged-artifact', rect: [1, 2, '3', 4] },
      { asset: 'diff/c.png', kind: 'judged-artifact', rect: [Number.NaN, 2, 3, 4] },
      { asset: 'diff/d.png', kind: 'judged-artifact', rect: 'not-an-array' },
      { asset: 'diff/e.png', kind: 'judged-artifact', rect: null },
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings.map((f) => f.rect)).toEqual([null, null, null, null, null]);
  });

  it('counts rejected for non-array inputs', () => {
    expect(parseScanReport(null)).toEqual({ findings: [], rejected: 1 });
    expect(parseScanReport(undefined)).toEqual({ findings: [], rejected: 1 });
    expect(parseScanReport({})).toEqual({ findings: [], rejected: 1 });
    expect(parseScanReport('not an array')).toEqual({ findings: [], rejected: 1 });
    expect(parseScanReport(42)).toEqual({ findings: [], rejected: 1 });
  });

  it('counts rejected for malformed records in array', () => {
    const raw = [
      null,
      123,
      'string',
      [],
      { kind: 'pair-identity' }, // missing asset
      { asset: '', kind: 'pair-identity' }, // empty asset
      { asset: '   ', kind: 'pair-identity' }, // whitespace asset
      { asset: 42, kind: 'pair-identity' }, // non-string asset
      { asset: 'diff/dog.png' }, // missing kind
      { asset: 'diff/dog.png', kind: '' }, // empty kind
      { asset: 'diff/dog.png', kind: 99 }, // non-string kind
      { asset: 'diff/valid.png', kind: 'pair-identity' }, // valid
    ];

    const result = parseScanReport(raw);

    expect(result.rejected).toBe(11);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].assetPath).toBe('assets/game/diff/valid.png');
  });
});

describe('parseLoopFindings', () => {
  it('parses valid loop finding with owning_asset as dirPath, screenshot as evidence and note', () => {
    const raw = [
      {
        surface: 'escape-toyroom',
        screenshot: 'round_1/shots/toyroom.png',
        class: 'ai_artifact',
        where: 'drawer lock',
        severity: 2,
        description: 'blurry texture around rim',
        owning_asset: 'assets/game/escape/toyroom/',
        regen_command: 'gen_escape.py --room toyroom',
      },
    ];

    const result = parseLoopFindings(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings).toEqual([
      {
        source: 'loop',
        category: 'ai_artifact',
        severity: 2,
        assetPath: null,
        dirPath: 'assets/game/escape/toyroom/',
        surface: 'escape-toyroom',
        rect: null,
        evidence: 'round_1/shots/toyroom.png',
        note: 'drawer lock: blurry texture around rim',
      },
    ]);
  });

  it('clamps severity to 1-3 range and handles invalid numeric strings', () => {
    const raw = [
      { class: 'c1', severity: -5 },
      { class: 'c2', severity: 0 },
      { class: 'c3', severity: 1 },
      { class: 'c4', severity: 2 },
      { class: 'c5', severity: 3 },
      { class: 'c6', severity: 4 },
      { class: 'c7', severity: 100 },
      { class: 'c8', severity: '3' },
      { class: 'c9', severity: 'invalid' },
      { class: 'c10' }, // missing severity defaults to 1
    ];

    const result = parseLoopFindings(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings.map((f) => f.severity)).toEqual([1, 1, 1, 2, 3, 3, 3, 3, 1, 1]);
  });

  it('handles missing optional fields with null and formatted note', () => {
    const raw = [
      {
        class: 'floating_pixel',
        where: 'sky',
        description: 'loose dot',
      },
      {
        class: 'seam',
      },
    ];

    const result = parseLoopFindings(raw);

    expect(result.rejected).toBe(0);
    expect(result.findings[0]).toEqual({
      source: 'loop',
      category: 'floating_pixel',
      severity: 1,
      assetPath: null,
      dirPath: null,
      surface: null,
      rect: null,
      evidence: null,
      note: 'sky: loose dot',
    });
    expect(result.findings[1].note).toBe(': ');
    expect(result.findings[1].dirPath).toBeNull();
    expect(result.findings[1].surface).toBeNull();
    expect(result.findings[1].evidence).toBeNull();
  });

  it('counts rejected for non-array inputs', () => {
    expect(parseLoopFindings(null)).toEqual({ findings: [], rejected: 1 });
    expect(parseLoopFindings(undefined)).toEqual({ findings: [], rejected: 1 });
    expect(parseLoopFindings({})).toEqual({ findings: [], rejected: 1 });
    expect(parseLoopFindings('loop findings')).toEqual({ findings: [], rejected: 1 });
    expect(parseLoopFindings(999)).toEqual({ findings: [], rejected: 1 });
  });

  it('counts rejected for records with missing class or malformed structure', () => {
    const raw = [
      null,
      123,
      'malformed',
      [],
      { surface: 'diff' }, // missing class
      { class: '', surface: 'diff' }, // empty class
      { class: '   ', surface: 'diff' }, // whitespace class
      { class: 123, surface: 'diff' }, // non-string class
      { class: 'ai_artifact', surface: 'diff' }, // valid
    ];

    const result = parseLoopFindings(raw);

    expect(result.rejected).toBe(8);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe('ai_artifact');
  });
});

describe('attachFindings', () => {
  const assets: MediaAsset[] = [
    {
      path: 'assets/game/diff/dog_0.png',
      kind: 'image',
      game: 'diff',
      group: 'dog',
      ledgerClean: true,
    },
    {
      path: 'assets/game/diff/dog_1.png',
      kind: 'image',
      game: 'diff',
      group: 'dog',
      ledgerClean: true,
    },
    {
      path: 'assets/game/escape/toyroom/clock.png',
      kind: 'image',
      game: 'escape',
      group: 'toyroom',
      ledgerClean: false,
    },
    {
      path: 'assets/game/escape/toyroom/desk.png',
      kind: 'image',
      game: 'escape',
      group: 'toyroom',
      ledgerClean: false,
    },
  ];

  it('matches exact assetPath and calculates maxSeverity', () => {
    const findings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/diff/dog_0.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: 'differing pixels',
      },
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/diff/dog_0.png',
        dirPath: null,
        surface: null,
        rect: [0, 0, 10, 10],
        evidence: 'crop.png',
        note: '',
      },
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/escape/toyroom/clock.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '',
      },
    ];

    const { entries, dirFindings, unmatched } = attachFindings(assets, findings);

    expect(dirFindings).toEqual([]);
    expect(unmatched).toEqual([]);

    const dog0Entry = entries.find((e) => e.asset.path === 'assets/game/diff/dog_0.png');
    expect(dog0Entry?.findings).toHaveLength(2);
    expect(dog0Entry?.maxSeverity).toBe(3);

    const clockEntry = entries.find((e) => e.asset.path === 'assets/game/escape/toyroom/clock.png');
    expect(clockEntry?.findings).toHaveLength(1);
    expect(clockEntry?.maxSeverity).toBe(2);
  });

  it('puts loop finding whose owning_asset is assets/game/escape/toyroom/ into dirFindings, not unmatched', () => {
    const loopFinding: ReviewFinding = {
      source: 'loop',
      category: 'ai_artifact',
      severity: 2,
      assetPath: null,
      dirPath: 'assets/game/escape/toyroom/',
      surface: 'escape-toyroom',
      rect: null,
      evidence: 'screenshot.png',
      note: 'lock: blurry',
    };

    const { dirFindings, unmatched } = attachFindings(assets, [loopFinding]);

    expect(dirFindings).toEqual([loopFinding]);
    expect(unmatched).toEqual([]);
  });

  it('places findings with non-matching assetPath or no assetPath/dirPath into unmatched', () => {
    const missingAssetFinding: ReviewFinding = {
      source: 'scan',
      category: 'judged-artifact',
      severity: 2,
      assetPath: 'assets/game/nonexistent.png',
      dirPath: null,
      surface: null,
      rect: null,
      evidence: null,
      note: '',
    };
    const orphanFinding: ReviewFinding = {
      source: 'loop',
      category: 'unknown',
      severity: 1,
      assetPath: null,
      dirPath: null,
      surface: null,
      rect: null,
      evidence: null,
      note: '',
    };

    const { unmatched } = attachFindings(assets, [missingAssetFinding, orphanFinding]);

    expect(unmatched).toEqual([missingAssetFinding, orphanFinding]);
  });

  it('sorts entries by maxSeverity desc, then path, with unflagged assets at maxSeverity 0 at the end', () => {
    const findings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'pair-identity',
        severity: 3,
        assetPath: 'assets/game/escape/toyroom/desk.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '',
      },
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 1,
        assetPath: 'assets/game/diff/dog_0.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '',
      },
    ];

    const { entries } = attachFindings(assets, findings);

    expect(entries.map((e) => ({ path: e.asset.path, maxSeverity: e.maxSeverity }))).toEqual([
      { path: 'assets/game/escape/toyroom/desk.png', maxSeverity: 3 },
      { path: 'assets/game/diff/dog_0.png', maxSeverity: 1 },
      { path: 'assets/game/diff/dog_1.png', maxSeverity: 0 },
      { path: 'assets/game/escape/toyroom/clock.png', maxSeverity: 0 },
    ]);

    const unflagged = entries.filter((e) => e.maxSeverity === 0);
    expect(unflagged).toHaveLength(2);
    expect(unflagged[0].findings).toEqual([]);
    expect(unflagged[1].findings).toEqual([]);
    expect(unflagged[0].asset.path < unflagged[1].asset.path).toBe(true);
  });

  it('sorts entries with identical positive maxSeverity alphabetically by path', () => {
    const findings: ReviewFinding[] = [
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/escape/toyroom/desk.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '',
      },
      {
        source: 'scan',
        category: 'judged-artifact',
        severity: 2,
        assetPath: 'assets/game/diff/dog_0.png',
        dirPath: null,
        surface: null,
        rect: null,
        evidence: null,
        note: '',
      },
    ];

    const { entries } = attachFindings(assets, findings);

    expect(entries.map((e) => ({ path: e.asset.path, maxSeverity: e.maxSeverity }))).toEqual([
      { path: 'assets/game/diff/dog_0.png', maxSeverity: 2 },
      { path: 'assets/game/escape/toyroom/desk.png', maxSeverity: 2 },
      { path: 'assets/game/diff/dog_1.png', maxSeverity: 0 },
      { path: 'assets/game/escape/toyroom/clock.png', maxSeverity: 0 },
    ]);
  });
});
