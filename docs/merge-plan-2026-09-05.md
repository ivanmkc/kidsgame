# Open PR review and merge plan — 2026-09-05

Reviewed all 11 open PRs against `master` @ `065253f2` (post Git-LFS history
rewrite). For every branch: fetched, test-merged onto current master, ran
`npx tsc --noEmit` and `npm test` (vitest) on the PR head, and ran both again
on the combined merge of everything mergeable. No PR has reviews, comments,
or CI checks on GitHub (the repo has no CI workflow besides the one-off LFS
migration).

`npx expo export --platform web` could not be exercised in the review
container: `git-lfs` is not installed there, so every PNG/JPG/WEBP is an LFS
pointer and Metro rejects it. The build claim in #26 was verified
structurally instead (see below).

## Results at a glance

| PR | Title | Base | Merge onto master | tsc | vitest | Verdict |
|---|---|---|---|---|---|---|
| #26 | fix(assets): missing ice_palace thumbnail | master | clean | ok | 344 | **Merge first** |
| #22 | fix(games): question clarity audit | master | clean | ok | 351 | **Merge** |
| #25 | fix(rhyme): Mandarin 十三辙 families | #22 | clean | ok | 354 | **Merge after #22** (retarget to master) |
| #24 | fix(compare): hard tier ratio rule | master | clean | ok | 346 | **Merge** |
| #23 | fix(shadow): pig/panda twins | master | clean | ok | 345 | **Merge** |
| #27 | fix(story): hotspots after narration | #26 | clean | ok | 344 | **Merge after #26** (retarget to master) |
| #19 | Crimson Escape (draft) | master | clean | ok | 358 | Ready when un-drafted |
| #21 | Veo rotoscope pipeline (draft) | master | clean | ok | 344 | Draft; pick over #20 |
| #20 | GEPA rest layers (draft) | master | clean alone, **conflicts with #21** | ok | 344 | Draft; rebase onto #21 or close |
| #18 | 18 hidden themes (draft) | master | **unrelated histories** | — | — | **Close — already on master** |
| #2 | Difficulty pills (draft) | master | **unrelated histories** | — | — | Re-port by hand or close |

Combined merge of #26, #22, #25, #24, #23, #27, #19, #21 onto master:
`tsc` clean, 371 tests passing across 16 files, no conflicts in that order.

## Merge order

### Phase 1 — bug fixes, ready now

1. **#26** `claude/fix-web-build-missing-thumb` → master.
   One LFS file. `src/assets/images.ts:1542` requires
   `assets/game/hidden/ice_palace_thumb.jpg`, which is absent on master, so
   the web bundle cannot resolve. Nothing else in the PR. Merge first: #27
   is stacked on it and #19 carries an identical copy of the same pointer
   (same LFS oid), which is why they don't conflict.
2. **#22** `claude/game-question-clarity-audit-2cum4j` → master.
   Six real defects with tests that fail on the old code. Read the diff:
   High/Low answer now derived from the notes (was a coin flip), Fast/Slow
   answer derived from bpm behind one constant, I/l glyph twin guard in
   letters, `things` category wording now includes presents, `altSounds` /
   `nameTwins` on `WordEntry` enforced in First Sounds and Bingo, and the
   `gen_voice.py` regex that stopped matching the per-language `not` record.
   One follow-up it names itself: `tools/gen_voice.py` must be re-run with
   Vertex credentials to actually synthesize the sixteen category questions
   and two reworded lines; until then they use browser TTS (no worse than
   today).
3. **#25** `claude/rhyme-mandarin-finals` — retarget from #22 to master after
   #22 lands (GitHub will do this automatically when #22 merges). Diff is
   `words.ts` only plus tests and an audit-doc correction; moves 章鱼/鱼 to
   the 一七 family, 螃蟹/蝴蝶 to 乜斜, and un-keys 汽车. The PR itself asks
   for a native-speaker glance at the 26-row 辙 table in the test; that is
   the only open item and is data review, not code.
4. **#24** `claude/compare-hard-ratio` → master. Adds a 1.25× ratio rule via
   `isFairPair()`; easy/medium provably unchanged by test. Independent of
   everything else.
5. **#23** `claude/shadow-silhouette-twins` → master. `SHADOW_TWINS` removes
   panda from pig's pool and vice versa; adds `tools/shadow_confusability.py`
   as a regeneration gate. Independent.
6. **#27** `claude/story-hotspots-after-narration` — retarget from #26 to
   master after #26 lands. Gates in-scene hotspots on `sayThen` completion
   with a 35s cap; scare/fx lines hand their completion to the parent so an
   interrupting line takes over the gate; effect cleanup marks the callback
   stale and `ScareSpot` clears its reveal timer on unmount, so page turns
   don't leak a reveal. Also deletes two clips the TTS sang instead of read
   and adds a per-script clip-length gate to `gen_voice.py`. Touches
   `tools/gen_voice.py` in a different region from #22 — merges cleanly in
   either order. Follow-up it names itself: re-run `gen_voice.py` to
   re-synthesize the two "Sing the lullaby" lines under the new gate.

Order among 2–5 does not matter; the sequence above was test-merged
end-to-end without conflicts.

### Phase 2 — drafts that are actually mergeable

7. **#19** `feat/crimson-room` (draft). Self-contained new game under
   `src/games/crimson/` plus a route, card, and i18n keys. tsc clean,
   358 tests including an end-to-end solvability test. Merges cleanly on
   top of Phase 1. Its extra commit adding `ice_palace_thumb.jpg` becomes a
   no-op once #26 is in. The only reason it isn't in Phase 1 is that it is
   marked draft — un-draft and merge whenever the game is wanted in the box.

### Phase 3 — escape pipeline drafts (mutually exclusive on assets)

#20 and #21 both regenerate the same 16 sprite sheets under
`public/escape-sprites/`, both rewrite `assets/game/escape/rocketpad_clean.png`,
and both edit the same hunk of `tools/gen/remove.py`. Merging one after the
other conflicts on all 18 files. They cannot both land as-is.

- **#21** `escape/veo-rotoscope-pipeline` is the later and larger line of
  work (10 commits through 2026-08-04 vs. #20's two on 07-26) and it also
  updates `src/assets/manifest.json` bboxes and `frameCount`, which
  `EscapeGame.tsx` reads to slice the sheets. #21's sprites and its manifest
  therefore have to ship together, and #20's sprites are only consistent
  with master's manifest. Treat #21 as the asset source of truth.
- **#20** `escape/rest-layers-gepa` contributes two tools #21 lacks
  (`tools/gen/rest_layers.py`, `tools/gen/sync_sprite_frames.py`) plus the
  feathered-compositing change in `remove.py`. Recommended: rebase #20 onto
  #21, drop its 17 binary asset changes and take #21's `remove.py`, keeping
  only the two new tools if they are still useful under the #21 pipeline.
  If #21's pipeline supersedes them, close #20.
- Both PRs' verification is Python tooling that needs Gemini/Vertex
  credentials; #21's own test plan still has the D.3 LLM rubric and full
  `verify_escape_chain.py` unchecked. Neither adds vitest coverage. They
  stay draft until the owner has run those gates. Merge #21 first, then the
  trimmed #20.

### Phase 4 — stale branches from before the LFS history rewrite

Both of these predate the LFS migration; `git merge` refuses them with
"unrelated histories" and GitHub shows them as dirty. They carry 116 and 84
commits of old history respectively; only the tip commit is the PR.

- **#18** `add-hidden-themes` — **close.** Its single commit adds 18 theme
  entries to `tools/gen/scenes_extra.py`. Current master already contains
  all 18 ids (haunted_house … sky_market) in that file, and the rendered
  scene assets for every one of them are committed under
  `assets/game/hidden/`. The work has landed by another route; nothing to
  merge.
- **#2** `feat/difficulty-card-details` — **re-port or close.** Master has
  no `cardDetail`, `shadowSettings`, or `oddSettings`; the feature is not
  on master. Cherry-picking `a88b8083` onto master conflicts in `App.tsx`,
  `OddOneGame.tsx`, and `ShadowGame.tsx` (all rewritten since July). If
  the pills are still wanted, start a fresh branch from master and re-apply
  the ~180-line change by hand using `a88b8083` as the reference; the
  design note at `docs/superpowers/specs/2026-07-07-difficulty-card-details-design.md`
  on that branch describes the intent. Then close #2.

## Post-merge follow-ups (called out by the PRs themselves)

- Run `python3 tools/gen_voice.py` with Vertex credentials once #22 and
  #27 are in: it synthesizes the sixteen Odd One Out category questions,
  the two reworded Rule Time / Odd One Out lines, and re-renders the two
  lullaby clips under the new length gate.
- Native-speaker check of the Mandarin 辙 table in
  `src/games/__tests__/quizsuite.test.ts` (#25).
- Consider a minimal CI workflow running `tsc --noEmit`, `vitest run`, and
  `expo export --platform web` with `git lfs pull`: #26 sat unnoticed
  because nothing builds the web bundle automatically.
