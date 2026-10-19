// @vitest-environment happy-dom
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../build_review';
import { escapeHtml, renderReviewPage, ReviewEntry } from '../page';

describe('human review page', () => {
  it('rendering a video entry yields a <video preload="none"> card and an image entry yields <img loading="lazy">', () => {
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'public/story-video/intro.mp4',
              kind: 'video',
              game: 'story',
              group: 'intro',
              ledgerClean: false,
            },
            findings: [],
            maxSeverity: 0,
          },
          {
            asset: {
              path: 'assets/game/diff/farm.png',
              kind: 'image',
              game: 'diff',
              group: 'farm',
              ledgerClean: true,
            },
            findings: [],
            maxSeverity: 0,
          },
        ],
        dirFindings: [],
      },
      { assetHref: (p) => `rel/${p}` },
    );

    document.body.innerHTML = html;

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('preload')).toBe('none');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('src')).toBe('rel/public/story-video/intro.mp4');

    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('src')).toBe('rel/assets/game/diff/farm.png');
  });

  it('severity-3 entries render before unflagged ones', () => {
    const entries: ReviewEntry[] = [
      {
        asset: {
          path: 'assets/game/diff/clean1.png',
          kind: 'image',
          game: 'diff',
          group: 'clean1',
          ledgerClean: false,
        },
        findings: [],
        maxSeverity: 0,
      },
      {
        asset: {
          path: 'assets/game/diff/flagged_sev3.png',
          kind: 'image',
          game: 'diff',
          group: 'flagged',
          ledgerClean: false,
        },
        findings: [
          {
            source: 'scan',
            category: 'seam',
            severity: 3,
            assetPath: 'assets/game/diff/flagged_sev3.png',
            dirPath: null,
            surface: null,
            rect: null,
            evidence: null,
            note: 'harsh seam',
          },
        ],
        maxSeverity: 3,
      },
      {
        asset: {
          path: 'assets/game/diff/clean2.png',
          kind: 'image',
          game: 'diff',
          group: 'clean2',
          ledgerClean: false,
        },
        findings: [],
        maxSeverity: 0,
      },
      {
        asset: {
          path: 'assets/game/diff/flagged_sev1.png',
          kind: 'image',
          game: 'diff',
          group: 'flagged1',
          ledgerClean: false,
        },
        findings: [
          {
            source: 'scan',
            category: 'fringe',
            severity: 1,
            assetPath: 'assets/game/diff/flagged_sev1.png',
            dirPath: null,
            surface: null,
            rect: null,
            evidence: null,
            note: 'minor fringe',
          },
        ],
        maxSeverity: 1,
      },
    ];

    const html = renderReviewPage({ entries, dirFindings: [] }, { assetHref: (p) => p });
    document.body.innerHTML = html;

    const cardPaths = Array.from(document.querySelectorAll('.card')).map((c) => c.getAttribute('data-path'));

    expect(cardPaths[0]).toBe('assets/game/diff/flagged_sev3.png');
    expect(cardPaths[1]).toBe('assets/game/diff/flagged_sev1.png');
    expect(cardPaths.indexOf('assets/game/diff/flagged_sev3.png')).toBeLessThan(
      cardPaths.indexOf('assets/game/diff/clean1.png'),
    );
    expect(cardPaths.indexOf('assets/game/diff/flagged_sev3.png')).toBeLessThan(
      cardPaths.indexOf('assets/game/diff/clean2.png'),
    );
  });

  it('a finding note containing <script>alert(1)</script> appears escaped in the output', () => {
    const malicious = '<script>alert(1)</script>';
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'assets/game/diff/xss.png',
              kind: 'image',
              game: 'diff',
              group: 'xss',
              ledgerClean: false,
            },
            findings: [
              {
                source: 'scan',
                category: 'exploit',
                severity: 2,
                assetPath: 'assets/game/diff/xss.png',
                dirPath: null,
                surface: null,
                rect: null,
                evidence: null,
                note: malicious,
              },
            ],
            maxSeverity: 2,
          },
        ],
        dirFindings: [
          {
            source: 'loop',
            category: 'dir-exploit',
            severity: 1,
            assetPath: null,
            dirPath: 'assets/game/escape/',
            surface: null,
            rect: null,
            evidence: null,
            note: malicious,
          },
        ],
      },
      { assetHref: (p) => p },
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain(malicious);
  });

  it('every verdict radio has an associated label and aria-label, and the output contains the export control and the review_decisions.json filename', () => {
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'assets/a.png',
              kind: 'image',
              game: 'diff',
              group: 'a',
              ledgerClean: false,
            },
            findings: [],
            maxSeverity: 0,
          },
          {
            asset: {
              path: 'assets/b.png',
              kind: 'image',
              game: 'hidden',
              group: 'b',
              ledgerClean: false,
            },
            findings: [],
            maxSeverity: 0,
          },
        ],
        dirFindings: [],
      },
      { assetHref: (p) => p },
    );

    document.body.innerHTML = html;
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.length).toBe(6); // 2 cards * 3 verdicts

    for (const radio of radios) {
      const aria = radio.getAttribute('aria-label');
      expect(aria).toBeTruthy();
      expect(['keep', 'regenerate', 'unsure']).toContain(aria);

      const label = document.querySelector<HTMLLabelElement>(`label[for="${radio.id}"]`);
      expect(label).toBeTruthy();
      expect(label?.textContent?.trim()).toBe(radio.value);
    }

    const exportBtn = document.querySelector('#export-decisions');
    expect(exportBtn).toBeTruthy();
    expect(exportBtn?.textContent).toContain('Export decisions');
    expect(html).toContain('review_decisions.json');
  });

  it('renders ledger-clean badge and findings details', () => {
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'assets/clean.png',
              kind: 'image',
              game: 'diff',
              group: 'clean',
              ledgerClean: true,
            },
            findings: [
              {
                source: 'scan',
                severity: 2,
                category: 'seam',
                note: 'minor misalignment',
                rect: [10, 20, 100, 200],
                evidence: 'crop1.png',
                assetPath: 'assets/clean.png',
                dirPath: null,
                surface: null,
              },
            ],
            maxSeverity: 2,
          },
        ],
        dirFindings: [
          {
            source: 'loop',
            severity: 1,
            category: 'general',
            note: 'directory note',
            assetPath: null,
            dirPath: 'assets/game/musicbox/twinkle/',
            surface: 'musicbox-twinkle',
            rect: null,
            evidence: 'crop_dir.png',
          },
        ],
        unmatched: [
          {
            source: 'scan',
            severity: 1,
            category: 'orphan',
            note: 'unmatched finding',
            assetPath: 'missing.png',
            dirPath: null,
            surface: null,
            rect: null,
            evidence: null,
          },
        ],
        rejectedCount: 2,
      },
      { assetHref: (p) => p },
    );

    expect(html).toContain('ledger-clean');
    expect(html).toContain('[10, 20, 100, 200]');
    document.body.innerHTML = html;
    expect(document.querySelector('img.finding-evidence-thumb[src="crop1.png"]')).toBeTruthy();
    expect(document.querySelector('img.finding-evidence-thumb[src="crop_dir.png"]')).toBeTruthy();
    expect(html).toContain('Directory Findings (1)');
    expect(html).toContain('assets/game/musicbox/twinkle/');
    expect(html).toContain('Unmatched findings: 1');
    expect(html).toContain('Rejected findings: 2');
  });

  it('displays total asset coverage count in the page header notes', () => {
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'assets/game/diff/farm.png',
              kind: 'image',
              game: 'diff',
              group: 'farm',
              ledgerClean: true,
            },
            findings: [],
            maxSeverity: 0,
          },
          {
            asset: {
              path: 'assets/game/diff/city.png',
              kind: 'image',
              game: 'diff',
              group: 'city',
              ledgerClean: true,
            },
            findings: [],
            maxSeverity: 0,
          },
        ],
        dirFindings: [],
      },
      { assetHref: (p) => p },
    );

    document.body.innerHTML = html;
    const statusNote = document.querySelector('.status-note');
    expect(statusNote).toBeTruthy();
    expect(statusNote?.textContent).toContain('Coverage: 2 assets');
  });

  it('escapeHtml escapes all HTML sensitive characters', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('hello & "world" <test> \'quoted\'')).toBe(
      'hello &amp; &quot;world&quot; &lt;test&gt; &#39;quoted&#39;',
    );
  });

  it('main() on a temp root with a fixture asset tree and scan report writes tools/audit_out/review/index.html and returns its path', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-root-test-'));
    try {
      const assetDir = path.join(tempRoot, 'assets', 'game', 'diff');
      fs.mkdirSync(assetDir, { recursive: true });
      fs.writeFileSync(path.join(assetDir, 'fixture_a.png'), 'fake-img-a');
      fs.writeFileSync(path.join(assetDir, 'fixture_b.png'), 'fake-img-b');

      const videoDir = path.join(tempRoot, 'public', 'story-video');
      fs.mkdirSync(videoDir, { recursive: true });
      fs.writeFileSync(path.join(videoDir, 'fixture_v.mp4'), 'fake-video');

      const toolsDir = path.join(tempRoot, 'tools');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: ['fixture_a'] }));

      const scanReport = [
        {
          asset: 'diff/fixture_b.png',
          kind: 'pair-identity',
          detail: '0.4% diff pixels',
        },
        {
          asset: 'assets/game/diff/fixture_a.png',
          kind: 'judged-artifact',
          severity: 2,
          rect: [0, 0, 50, 50],
          crop: 'crop_a.png',
        },
      ];

      const scanFile = path.join(tempRoot, 'scan_report.json');
      fs.writeFileSync(scanFile, JSON.stringify(scanReport));

      const outPath = main(['--scan', scanFile], tempRoot);
      expect(outPath).toBe(path.join(tempRoot, 'tools', 'audit_out', 'review', 'index.html'));
      expect(fs.existsSync(outPath)).toBe(true);

      const html = fs.readFileSync(outPath, 'utf-8');
      expect(html).toContain('fixture_a.png');
      expect(html).toContain('fixture_b.png');
      expect(html).toContain('fixture_v.mp4');
      expect(html).toContain('0.4% diff pixels');
      expect(html).toContain('href="../../../crop_a.png"');
      document.body.innerHTML = html;
      expect(document.querySelector('img.finding-evidence-thumb[src="../../../crop_a.png"]')).toBeTruthy();
      expect(html).toContain('review_decisions.json');
      // Relative asset href from tools/audit_out/review
      expect(html).toContain('../../../assets/game/diff/fixture_a.png');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('main() parses --loop and captures screenshot evidence and where description', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-root-loop-'));
    try {
      const toolsDir = path.join(tempRoot, 'tools');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: [] }));

      const loopReport = [
        {
          surface: 'escape-toyroom',
          owning_asset: 'assets/game/escape/toyroom/',
          class: 'rectangular_seam',
          severity: 2,
          where: 'top-left',
          description: 'slight seam in toyroom',
          screenshot: 'shots/shot_0.png',
        },
      ];
      const loopFile = path.join(tempRoot, 'loop.json');
      fs.writeFileSync(loopFile, JSON.stringify(loopReport));

      const outPath = main(['--loop', loopFile], tempRoot);
      const html = fs.readFileSync(outPath, 'utf-8');
      expect(html).toContain('top-left: slight seam in toyroom');
      expect(html).toContain('href="../../../shots/shot_0.png"');
      document.body.innerHTML = html;
      expect(document.querySelector('img.finding-evidence-thumb[src="../../../shots/shot_0.png"]')).toBeTruthy();
      expect(html).toContain('assets/game/escape/toyroom/');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('asserts assets/game/musicbox/twinkle/bg.png is not marked ledger-clean when clean has music', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-ledger-check-'));
    try {
      const musicDir = path.join(tempRoot, 'assets', 'game', 'musicbox', 'twinkle');
      fs.mkdirSync(musicDir, { recursive: true });
      fs.writeFileSync(path.join(musicDir, 'bg.png'), 'fake-png');

      const toolsDir = path.join(tempRoot, 'tools');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: ['music'] }));

      const outPath = main([], tempRoot);
      const html = fs.readFileSync(outPath, 'utf-8');
      document.body.innerHTML = html;

      const card = document.querySelector('.card[data-path="assets/game/musicbox/twinkle/bg.png"]');
      expect(card).toBeTruthy();
      expect(card?.querySelector('.ledger-clean')).toBeNull();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails loudly when an explicit --scan or --loop file does not exist', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-fail-loudly-'));
    try {
      const toolsDir = path.join(tempRoot, 'tools');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: [] }));

      expect(() => main(['--scan', 'missing_scan.json'], tempRoot)).toThrow();
      expect(() => main(['--loop', 'missing_loop.json'], tempRoot)).toThrow();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails loudly when quality_ledger.json is missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-missing-ledger-'));
    try {
      expect(() => main([], tempRoot)).toThrow();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('renders candidate and accept/reject/unsure radios when candidatePath is present', () => {
    const html = renderReviewPage(
      {
        entries: [
          {
            asset: {
              path: 'assets/game/diff/foo.png',
              kind: 'image',
              game: 'diff',
              group: 'foo',
              ledgerClean: false,
            },
            findings: [],
            maxSeverity: 0,
            candidatePath: 'tmp/candidates/assets/game/diff/foo.png',
          },
        ],
        dirFindings: [],
      },
      { assetHref: (p) => p },
    );
    expect(html).toContain('tmp/candidates/assets/game/diff/foo.png');
    expect(html).toContain('value="accept"');
    expect(html).toContain('value="reject"');
    expect(html).not.toContain('value="keep"');
    expect(html).not.toContain('value="regenerate"');
    expect(html).toContain('value="unsure"');
  });

  it('main() attaches candidatePath if file exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-candidate-'));
    try {
      const assetDir = path.join(tempRoot, 'assets', 'game', 'diff');
      fs.mkdirSync(assetDir, { recursive: true });
      fs.writeFileSync(path.join(assetDir, 'foo.png'), 'fake-img');

      const candDir = path.join(tempRoot, 'tmp', 'candidates', 'assets', 'game', 'diff');
      fs.mkdirSync(candDir, { recursive: true });
      fs.writeFileSync(path.join(candDir, 'foo.png'), 'fake-candidate');

      const toolsDir = path.join(tempRoot, 'tools');
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'quality_ledger.json'), JSON.stringify({ clean: [] }));

      const outPath = main([], tempRoot);
      const html = fs.readFileSync(outPath, 'utf-8');
      
      expect(html).toContain('tmp/candidates/assets/game/diff/foo.png');
      expect(html).toContain('value="accept"');
      expect(html).toContain('value="reject"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
