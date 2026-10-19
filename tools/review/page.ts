import type { ReviewEntry, ReviewFinding } from './findings';

export type { ReviewEntry, ReviewFinding } from './findings';

export interface ReviewPageResult {
  entries: ReviewEntry[];
  dirFindings: ReviewFinding[];
  unmatched?: ReviewFinding[];
  rejectedCount?: number;
}

export interface RenderOptions {
  assetHref: (repoPath: string) => string;
}

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const VERDICTS = ['keep', 'regenerate', 'unsure'] as const;

export function renderReviewPage(result: ReviewPageResult, opts: { assetHref: (repoPath: string) => string }): string {
  const sorted = [...result.entries].sort((a, b) => {
    const diff = b.maxSeverity - a.maxSeverity;
    if (diff !== 0) return diff;
    return a.asset.path.localeCompare(b.asset.path);
  });

  const games = Array.from(new Set(result.entries.map((e) => e.asset.game))).sort();

  const notes: string[] = [];
  notes.push(`Coverage: ${result.entries.length} assets`);
  if (result.unmatched && result.unmatched.length > 0) {
    notes.push(`Unmatched findings: ${result.unmatched.length}`);
  }
  if (result.rejectedCount && result.rejectedCount > 0) {
    notes.push(`Rejected findings: ${result.rejectedCount}`);
  }
  const statusNoteHtml = notes.length > 0 ? `<p class="status-note">${escapeHtml(notes.join(' | '))}</p>` : '';

  const dirFindingsHtml =
    result.dirFindings && result.dirFindings.length > 0
      ? `<section class="dir-findings" aria-label="Directory findings">
        <h2>Directory Findings (${result.dirFindings.length})</h2>
        <div class="findings-list">
          ${result.dirFindings
            .map((f) => {
              const rectText = f.rect ? `[${f.rect.join(', ')}]` : '';
              const target = f.dirPath || f.surface || '';
              return `<div class="finding finding-sev-${f.severity}">
              <span class="badge severity">Sev ${escapeHtml(f.severity)}</span>
              <span class="badge category">${escapeHtml(f.category)}</span>
              ${target ? `<code>${escapeHtml(target)}</code>` : ''}
              <span class="finding-note">${escapeHtml(f.note)}</span>
              ${rectText ? `<span class="finding-rect">${escapeHtml(rectText)}</span>` : ''}
              ${f.evidence ? `<a class="finding-evidence" href="${escapeHtml(opts.assetHref(f.evidence))}" target="_blank" rel="noopener"><img class="finding-evidence-thumb" loading="lazy" src="${escapeHtml(opts.assetHref(f.evidence))}" alt="evidence" /></a>` : ''}
            </div>`;
            })
            .join('')}
        </div>
      </section>`
      : '';

  const cardsHtml = sorted
    .map((entry, i) => {
      const entryPath = entry.asset.path;
      const isVideo = entry.asset.kind === 'video';
      let mediaHtml = isVideo
        ? `<video preload="none" controls src="${escapeHtml(opts.assetHref(entryPath))}"></video>`
        : `<img loading="lazy" src="${escapeHtml(opts.assetHref(entryPath))}" alt="${escapeHtml(entryPath)}" />`;

      if (entry.candidatePath) {
        const candHtml = isVideo
          ? `<video preload="none" controls src="${escapeHtml(opts.assetHref(entry.candidatePath))}"></video>`
          : `<img loading="lazy" src="${escapeHtml(opts.assetHref(entry.candidatePath))}" alt="${escapeHtml(entry.candidatePath)}" />`;
        mediaHtml += candHtml;
      }

      const isFlagged = entry.maxSeverity > 0;
      const cleanBadge = entry.asset.ledgerClean ? '<span class="badge ledger-clean">ledger-clean</span>' : '';
      const game = entry.asset.game;

      const findingsHtml =
        entry.findings && entry.findings.length > 0
          ? `<div class="findings-list">
          ${entry.findings
            .map((f) => {
              const rectText = f.rect ? `[${f.rect.join(', ')}]` : '';
              return `<div class="finding finding-sev-${f.severity}">
              <span class="badge severity">Sev ${escapeHtml(f.severity)}</span>
              <span class="badge category">${escapeHtml(f.category)}</span>
              <span class="finding-note">${escapeHtml(f.note)}</span>
              ${rectText ? `<span class="finding-rect">${escapeHtml(rectText)}</span>` : ''}
              ${f.evidence ? `<a class="finding-evidence" href="${escapeHtml(opts.assetHref(f.evidence))}" target="_blank" rel="noopener"><img class="finding-evidence-thumb" loading="lazy" src="${escapeHtml(opts.assetHref(f.evidence))}" alt="evidence" /></a>` : ''}
            </div>`;
            })
            .join('')}
        </div>`
          : '';

      const verdicts = entry.candidatePath ? ['accept', 'reject', 'unsure'] : VERDICTS;
      const radiosHtml = verdicts.map((v) => {
        const radioId = `verdict-${i}-${v}`;
        return `<div class="verdict-option">
        <input type="radio" id="${radioId}" name="verdict-${i}" value="${v}" aria-label="${v}" data-path="${escapeHtml(entryPath)}" />
        <label for="${radioId}">${v}</label>
      </div>`;
      }).join('');

      const noteId = `note-${i}`;
      return `<article class="card ${isFlagged ? 'flagged' : 'unflagged'}" data-game="${escapeHtml(game)}" data-flagged="${isFlagged}" data-path="${escapeHtml(entryPath)}">
      <div class="card-media">${mediaHtml}</div>
      <div class="card-body">
        <div class="card-meta">
          <span class="entry-path">${escapeHtml(entryPath)}</span>
          <span class="badge game">${escapeHtml(game)}</span>
          ${cleanBadge}
        </div>
        ${findingsHtml}
        <fieldset class="verdict-group">
          <legend>Verdict</legend>
          ${radiosHtml}
        </fieldset>
        <div class="card-note">
          <label for="${noteId}">Note</label>
          <textarea id="${noteId}" class="entry-note" data-path="${escapeHtml(entryPath)}" placeholder="Notes..."></textarea>
        </div>
      </div>
    </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Human Review</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #1e293b; }
    header { background: #fff; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    .controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #e2e8f0; }
    .badge.ledger-clean { background: #dcfce7; color: #166534; }
    .badge.severity { background: #fee2e2; color: #991b1b; }
    .badge.game { background: #e0e7ff; color: #3730a3; }
    .status-note { font-size: 13px; color: #b45309; margin: 8px 0 0; }
    .dir-findings { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .card { background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
    .card.flagged { border-top: 4px solid #ef4444; }
    .card-media { background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 200px; max-height: 280px; gap: 8px; }
    .card-media img, .card-media video { max-width: 100%; max-height: 280px; object-fit: contain; min-width: 0; }
    .card-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
    .card-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; }
    .entry-path { word-break: break-all; font-family: monospace; font-size: 12px; }
    .findings-list { display: flex; flex-direction: column; gap: 8px; background: #fef2f2; padding: 8px; border-radius: 6px; }
    .finding { font-size: 13px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .finding-evidence-thumb { max-height: 48px; border-radius: 4px; vertical-align: middle; }
    .verdict-group { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; display: flex; gap: 16px; }
    .verdict-group legend { font-size: 12px; font-weight: 600; padding: 0 4px; }
    .verdict-option { display: flex; align-items: center; gap: 4px; cursor: pointer; text-transform: capitalize; }
    .card-note { display: flex; flex-direction: column; gap: 4px; }
    .card-note label { font-size: 12px; font-weight: 600; }
    .entry-note { width: 100%; box-sizing: border-box; resize: vertical; min-height: 48px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; font-family: inherit; }
    button { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <header>
    <h1>Human Review</h1>
    <div class="controls">
      <label for="filter-game">Game:</label>
      <select id="filter-game" aria-label="Filter by game">
        <option value="">All games</option>
        ${games.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
      </select>
      <label for="filter-flagged">
        <input type="checkbox" id="filter-flagged" /> flagged only
      </label>
      <button id="export-decisions" aria-label="Export decisions" data-filename="review_decisions.json">Export decisions</button>
    </div>
    ${statusNoteHtml}
    ${dirFindingsHtml}
  </header>
  <main class="cards-grid">
    ${cardsHtml}
  </main>
  <script>
  (function() {
    const STORAGE_KEY = 'review_decisions';
    function readSaved() {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    function writeSaved(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    function gatherDecisions() {
      const decisions = [];
      document.querySelectorAll('.card').forEach(card => {
        const path = card.getAttribute('data-path');
        if (!path) return;
        const checked = card.querySelector('input[type="radio"]:checked');
        const noteEl = card.querySelector('.entry-note');
        const note = noteEl ? noteEl.value : '';
        if (checked || (note && note.trim())) {
          decisions.push({ path, verdict: checked ? checked.value : 'unsure', note });
        }
      });
      return decisions;
    }
    function syncUI() {
      const saved = readSaved();
      const map = new Map(saved.map(d => [d.path, d]));
      document.querySelectorAll('.card').forEach(card => {
        const path = card.getAttribute('data-path');
        const d = path ? map.get(path) : null;
        if (d) {
          if (d.verdict) {
            const radio = card.querySelector('input[type="radio"][value="' + d.verdict + '"]');
            if (radio) radio.checked = true;
          }
          if (d.note) {
            const noteEl = card.querySelector('.entry-note');
            if (noteEl) noteEl.value = d.note;
          }
        }
      });
    }
    function applyFilters() {
      const game = document.getElementById('filter-game')?.value || '';
      const flaggedOnly = !!document.getElementById('filter-flagged')?.checked;
      document.querySelectorAll('.card').forEach(card => {
        const cardGame = card.getAttribute('data-game') || '';
        const isFlagged = card.getAttribute('data-flagged') === 'true';
        const show = (!game || cardGame === game) && (!flaggedOnly || isFlagged);
        card.style.display = show ? '' : 'none';
      });
    }
    function init() {
      syncUI();
      applyFilters();
      document.addEventListener('change', e => {
        if (e.target.matches('input[type="radio"]') || e.target.matches('.entry-note')) {
          writeSaved(gatherDecisions());
        }
        if (e.target.id === 'filter-game' || e.target.id === 'filter-flagged') {
          applyFilters();
        }
      });
      document.addEventListener('input', e => {
        if (e.target.matches('.entry-note')) {
          writeSaved(gatherDecisions());
        }
      });
      document.getElementById('export-decisions')?.addEventListener('click', () => {
        const decisions = gatherDecisions();
        const blob = new Blob([JSON.stringify(decisions, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'review_decisions.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  </script>
</body>
</html>`;
}
