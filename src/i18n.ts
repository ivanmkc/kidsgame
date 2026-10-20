import { Lang } from './lang';
import { CMN } from './i18n/cmn';
import { JA } from './i18n/ja';
import { YUE } from './i18n/yue';

// UI-text localization for the app chrome (menu + shared game surfaces).
// Game-internal SPOKEN lines are localized elsewhere (via lang.ts /
// per-game logic modules) and MUST stay in their own tables — this module
// only owns what actually paints on screen.
//
// Contract:
//   t(lang, key)        → returns the translated string for `lang`.
//   t(lang, key, {..})  → same, with `{name}` placeholders interpolated.
//
// English strings must be byte-identical to what they were before this
// module existed — English mode is the untouched baseline.
export type UIKey =
  // ── Menu chrome ────────────────────────────────────────────────
  | 'menu.heading'
  | 'menu.word'
  | 'menu.number'
  | 'menu.grownups'
  | 'badge.beta'
  | 'menu.play'
  | 'chip.sound'
  | 'chip.muted'
  | 'chip.twoPlayers'
  | 'chip.twoPlayersOn'
  | 'a11y.langCycle'
  | 'a11y.diffCycle'
  | 'a11y.soundOn'
  | 'a11y.soundOff'
  | 'a11y.twoPlayer'
  | 'a11y.backMenu'
  | 'a11y.backPicker'
  | 'grownups.install'
  | 'grownups.share'
  | 'grownups.copied'
  | 'grownups.feedback'
  | 'install.iosHint'
  | 'install.iosHelp'
  | 'share.copied'
  // ── Difficulty filter chip ─────────────────────────────────────
  | 'filter.all'
  | 'filter.easy'
  | 'filter.medium'
  | 'filter.hard'
  | 'filter.allLevels'
  | 'filter.easyLevels'
  | 'filter.mediumLevels'
  | 'filter.hardLevels'
  // ── Menu game cards: titles + blurbs ───────────────────────────
  | 'card.spotit.title'   | 'card.spotit.blurb'
  | 'card.diff.title'     | 'card.diff.blurb'
  | 'card.hidden.title'   | 'card.hidden.blurb'
  | 'card.memory.title'   | 'card.memory.blurb'
  | 'card.puzzle.title'   | 'card.puzzle.blurb'
  | 'card.shadow.title'   | 'card.shadow.blurb'
  | 'card.oddone.title'   | 'card.oddone.blurb'
  | 'card.rules.title'    | 'card.rules.blurb'
  | 'card.rules.banner'
  | 'card.sticker.title'  | 'card.sticker.blurb'
  | 'card.story.title'    | 'card.story.blurb'
  | 'card.letters.title'  | 'card.letters.blurb'
  | 'card.sounds.title'   | 'card.sounds.blurb'
  | 'card.rhyme.title'    | 'card.rhyme.blurb'
  | 'card.spell.title'    | 'card.spell.blurb'
  | 'card.listenchoose.title' | 'card.listenchoose.blurb'
  | 'card.count.title'    | 'card.count.blurb'
  | 'card.numbers.title'  | 'card.numbers.blurb'
  | 'card.compare.title'  | 'card.compare.blurb'
  | 'card.sums.title'     | 'card.sums.blurb'
  | 'card.musicbox.title' | 'card.musicbox.blurb'
  | 'card.bingo.title'    | 'card.bingo.blurb'
  | 'card.carmode.title'  | 'card.carmode.blurb'
  | 'card.escape.title'   | 'card.escape.blurb'
  | 'card.highlow.title'  | 'card.highlow.blurb'
  | 'card.bells.title'    | 'card.bells.blurb'
  | 'card.echobeat.title' | 'card.echobeat.blurb'
  | 'card.steadybeat.title' | 'card.steadybeat.blurb'
  | 'card.fastslow.title' | 'card.fastslow.blurb'
  | 'card.samediff.title' | 'card.samediff.blurb'
  // ── ScenePicker surfaces ───────────────────────────────────────
  | 'picker.surprise'
  | 'picker.diff'
  | 'picker.hidden'
  | 'picker.story'
  | 'picker.sticker'
  | 'picker.puzzle'
  // ── ModePicker ─────────────────────────────────────────────────
  | 'mp.title'
  | 'mp.solo'
  | 'mp.duo'
  // ── GameShell titles + subtitles ───────────────────────────────
  | 'shell.levels'
  | 'shell.letters.title'
  | 'shell.letters.titleKana'
  | 'shell.letters.subTap'
  | 'shell.letters.subSound'
  | 'shell.numbers.title'
  | 'shell.numbers.titleHan'
  | 'shell.numbers.sub'
  | 'shell.sounds.titleEn'
  | 'shell.sounds.titleWords'
  | 'shell.sounds.subEn'
  | 'shell.sounds.subWord'
  | 'shell.rhyme.title'
  | 'shell.rhyme.sub'
  | 'shell.spell.title'
  | 'shell.spell.sub'
  | 'spell.hearAgain'
  | 'shell.listenchoose.title'
  | 'shell.listenchoose.sub'
  | 'listenchoose.play'
  | 'listenchoose.captions'
  | 'listenchoose.on'
  | 'listenchoose.off'
  | 'shell.count.title'
  | 'shell.count.sub'
  | 'shell.compare.title'
  | 'shell.compare.subMore'
  | 'shell.compare.subFewer'
  | 'shell.sums.title'
  | 'shell.sums.sub'
  | 'shell.spotit.title'
  | 'shell.spotit.sub'
  | 'shell.spotitDuel.title'
  | 'shell.spotitDuel.sub'
  | 'shell.diff.title'
  | 'shell.diff.subPicker'
  | 'shell.diff.subPlay'
  | 'shell.hidden.title'
  | 'shell.hidden.subPicker'
  | 'shell.hidden.subPlay'
  | 'shell.sticker.title'
  | 'shell.sticker.subPicker'
  | 'shell.sticker.subPlay'
  | 'shell.story.title'
  | 'shell.story.subPicker'
  | 'shell.memory.title'
  | 'shell.memory.sub'
  | 'shell.shadow.title'
  | 'shell.shadow.sub'
  | 'shell.shadow.subTricky'
  | 'shell.oddone.title'
  | 'shell.oddone.sub'
  | 'shell.rules.title'
  | 'shell.rules.sub'
  | 'shell.puzzle.title'
  | 'shell.puzzle.subPicker'
  | 'shell.puzzle.subPlay'
  | 'shell.musicbox.title'
  | 'shell.musicbox.subPicker'
  | 'shell.musicbox.subPlay'
  | 'shell.bingo.title'
  | 'shell.bingo.sub'
  | 'shell.bingo.subPhonics'
  | 'shell.carmode.title'
  | 'shell.carmode.sub'
  | 'shell.escape.title'
  | 'shell.escape.subPicker'
  | 'shell.escape.subPlay'
  | 'picker.escape'
  | 'escape.trayEmpty'
  // ── Music game shells ──────────────────────────────────────────
  | 'menu.music'
  | 'shell.highlow.title'   | 'shell.highlow.sub'
  | 'shell.bells.title'     | 'shell.bells.sub'
  | 'shell.echobeat.title'  | 'shell.echobeat.sub'
  | 'shell.steadybeat.title' | 'shell.steadybeat.sub'
  | 'shell.fastslow.title'  | 'shell.fastslow.sub'
  | 'shell.samediff.title'  | 'shell.samediff.sub'
  | 'music.listen'
  | 'music.yourTurn'
  | 'music.high'
  | 'music.low'
  | 'music.fast'
  | 'music.slow'
  | 'music.same'
  | 'music.different'
  // ── WinOverlay: labels + per-game messages ─────────────────────
  | 'overlay.next'
  | 'overlay.nextRound'
  | 'overlay.playAgain'
  | 'overlay.rematch'
  | 'overlay.rematchDuel'
  | 'overlay.allGames'
  | 'win.diff'
  | 'win.hidden'
  | 'win.hiddenCoop'
  | 'win.memory'
  | 'win.memoryTie'
  | 'win.memoryWinner'
  | 'win.shadow'
  | 'win.oddone'
  | 'win.rules'
  | 'win.puzzle'
  | 'win.spotit'
  | 'win.spotitTimed'
  | 'win.spotitDuel'
  | 'win.spotitDuelSub'
  | 'win.spotitDuelSubOne'
  | 'win.letters'
  | 'win.lettersKana'
  | 'win.numbers'
  | 'win.sounds'
  | 'win.soundsWords'
  | 'win.rhyme'
  | 'win.spell'
  | 'win.count'
  | 'win.compare'
  | 'win.sums'
  | 'win.bingo'
  | 'win.musicbox'
  | 'win.highlow'
  | 'win.bells'
  | 'win.echobeat'
  | 'win.steadybeat'
  | 'win.fastslow'
  | 'win.samediff'
  // ── Music box ──────────────────────────────────────────────────
  | 'musicbox.intro'
  | 'musicbox.introFree'
  | 'musicbox.freeplay'
  | 'musicbox.stage'
  | 'musicbox.note'
  | 'song.twinkle'
  | 'song.mary'
  | 'song.row'
  | 'song.london'
  | 'song.spider'
  | 'song.macdonald'
  | 'song.jingle'
  // ── Displayed in-game hints ────────────────────────────────────
  | 'diff.pictureA'
  | 'diff.pictureB'
  | 'diff.hint'
  | 'shadow.hint'
  | 'shadow.hintTricky'
  | 'rules.memoryCheck'
  | 'rules.ruleNumber'
  | 'rules.doAgain'
  | 'rules.remind'
  | 'rules.progress'
  | 'puzzle.peek'
  | 'puzzle.peek.a11y'
  | 'puzzle.hint'
  | 'sticker.clear'
  | 'sticker.hint'
  | 'sticker.tab.dressup'
  | 'sticker.tab.characters'
  | 'sticker.tab.animals'
  | 'sticker.tab.nature'
  | 'sticker.tab.food'
  | 'sticker.tab.things'
  | 'sticker.size.small'
  | 'sticker.size.medium'
  | 'sticker.size.large'
  | 'sticker.charactersEmpty'
  | 'memory.moves'
  | 'memory.cardFaceDown'
  | 'rhyme.ask'
  | 'rhyme.comingSoon'
  | 'story.tryAgain'
  | 'story.startOver'
  | 'story.readAgain'
  | 'story.allStories'
  // ── Feedback modal ─────────────────────────────────────────────
  | 'feedback.chip'
  | 'feedback.title'
  | 'feedback.broken'
  | 'feedback.idea'
  | 'feedback.placeholder'
  | 'feedback.cancel'
  | 'feedback.send'
  | 'feedback.thanks'
  // ── Adult gate ─────────────────────────────────────────────────
  | 'gate.title'
  | 'gate.holdPrompt'
  | 'gate.holdA11y'
  | 'gate.holdButton'
  | 'gate.cancel'
  | 'gate.wordTitle'
  | 'gate.wordPrompt'
  | 'gate.wordPlaceholder'
  | 'gate.continue';

export type Table = Record<UIKey, string>;

// English baseline — MUST match the literal strings that were already in
// the app before i18n existed. Do not "improve" copy here; if wording
// changes, update it everywhere at once.
export const EN: Table = {
  'menu.heading': 'Kids Game Box',
  'menu.word': 'Word Games 🔤',
  'menu.number': 'Number Games 🔢',
  'menu.grownups': 'For grown-ups 🧑‍🍼',
  'badge.beta': 'BETA',
  'menu.play': 'PLAY',
  'chip.sound': '🔊 Sound',
  'chip.muted': '🔇 Muted',
  'chip.twoPlayers': '👯 2 Players',
  'chip.twoPlayersOn': '👯 2 Players ✓',
  'a11y.langCycle': 'Language: {name}. Tap to change',
  'a11y.diffCycle': 'Difficulty: {name}. Tap to change',
  'a11y.soundOn': 'Turn sound on',
  'a11y.soundOff': 'Turn sound off',
  'a11y.twoPlayer': 'Two player mode',
  'a11y.backMenu': 'Back to menu',
  'a11y.backPicker': 'Back to level choices',
  'grownups.install': '📲 Add to Home Screen',
  'grownups.share': '📤 Share with Parents',
  'grownups.copied': '✅ Link copied!',
  'grownups.feedback': '💬 Send Feedback',
  'install.iosHint': 'Add to home screen',
  'install.iosHelp': 'Tap Share ↑ then “Add to Home Screen”',
  'share.copied': 'Link copied!',
  'filter.all': 'All',
  'filter.easy': 'Easy',
  'filter.medium': 'Medium',
  'filter.hard': 'Hard',
  'filter.allLevels': 'All levels',
  'filter.easyLevels': 'Easy levels',
  'filter.mediumLevels': 'Medium levels',
  'filter.hardLevels': 'Hard levels',

  'card.spotit.title': 'Spot It!',
  'card.spotit.blurb': 'Find the matching picture on both cards',
  'card.diff.title': 'Find the Difference',
  'card.diff.blurb': 'What changed between the two pictures?',
  'card.hidden.title': 'Hidden Objects',
  'card.hidden.blurb': 'Hunt for the secret things in the scene',
  'card.memory.title': 'Memory Match',
  'card.memory.blurb': 'Flip the cards and find the pairs',
  'card.puzzle.title': 'Picture Puzzle',
  'card.puzzle.blurb': 'Put the mixed-up picture back together',
  'card.shadow.title': 'Shadow Match',
  'card.shadow.blurb': 'Whose shadow is that? Match it!',
  'card.oddone.title': 'Odd One Out',
  'card.oddone.blurb': 'Which one does not belong?',
  'card.rules.title': 'Rule Time!',
  'card.rules.blurb': 'Follow the rule — tap the right ones!',
  'card.rules.banner': 'Tap all the ANIMALS! 🐾',
  'card.sticker.title': 'Sticker Party',
  'card.sticker.blurb': 'Decorate scenes with silly stickers!',
  'card.story.title': 'Story Path',
  'card.story.blurb': 'Pick what happens next in the tale!',
  'card.letters.title': 'Letter Hunt',
  'card.letters.blurb': 'Find the letter — quick, before it hides!',
  'card.sounds.title': 'First Sounds',
  'card.sounds.blurb': 'Which one starts with that sound?',
  'card.rhyme.title': 'Rhyme Time',
  'card.rhyme.blurb': 'Frog... dog! Find what rhymes!',
  'card.spell.title': 'Word Builder',
  'card.spell.blurb': 'Tap the letters to build the word!',
  'card.listenchoose.title': 'Listen and Choose',
  'card.listenchoose.blurb': 'Hear a word and tap the matching picture',
  'card.count.title': 'Count With Me',
  'card.count.blurb': 'Tap and count every little critter!',
  'card.numbers.title': 'Number Hunt',
  'card.numbers.blurb': 'Find the number — one, two, three!',
  'card.compare.title': 'More or Less',
  'card.compare.blurb': 'Which side has more treats?',
  'card.sums.title': 'Little Sums',
  'card.sums.blurb': 'One more hops in — how many now?',
  'card.musicbox.title': 'Music Box',
  'card.musicbox.blurb': 'Tap along and play a song!',
  'card.bingo.title': 'Picture Bingo',
  'card.bingo.blurb': 'Listen for the call and find it on your board!',
  'card.carmode.title': 'Car Mode',
  'card.carmode.blurb': 'Audio games for the car — no looking needed!',
  'card.escape.title': 'Little Escapes',
  'card.escape.blurb': 'Find, unlock, and save the day!',
  'card.highlow.title': 'High or Low',
  'card.highlow.blurb': 'Was the second note higher or lower?',
  'card.bells.title': 'Melody Bells',
  'card.bells.blurb': 'Repeat the tune on the bells!',
  'card.echobeat.title': 'Echo Beat',
  'card.echobeat.blurb': 'Listen to the beat, tap it back!',
  'card.steadybeat.title': 'Steady Beat',
  'card.steadybeat.blurb': 'Keep the beat going — tap along!',
  'card.fastslow.title': 'Fast or Slow',
  'card.fastslow.blurb': 'Was that music fast or slow?',
  'card.samediff.title': 'Same or Different',
  'card.samediff.blurb': 'Do the two tunes sound the same?',

  'picker.surprise': '🎲 Surprise me!',
  'picker.diff': 'Where do you want to play?',
  'picker.hidden': 'Where do you want to search?',
  'picker.story': 'Which story shall we read?',
  'picker.sticker': "Where's the party?",
  'picker.puzzle': 'Which picture do you want to solve?',
  'mp.title': 'How many players?',
  'mp.solo': '1 Player 🧒',
  'mp.duo': '2 Players 👧👧',

  'shell.letters.title': 'Letter Hunt',
  'shell.levels': 'Levels',
  'shell.letters.titleKana': 'Kana Hunt',
  'shell.letters.subTap': 'Tap the letter you hear',
  'shell.letters.subSound': 'Which letter makes that sound?',
  'shell.numbers.title': 'Number Hunt',
  'shell.numbers.titleHan': 'Number Hunt (漢数字)',
  'shell.numbers.sub': 'Tap the number you hear',
  'shell.sounds.titleEn': 'First Sounds',
  'shell.sounds.titleWords': 'First Words',
  'shell.sounds.subEn': 'Tap the picture that starts with the sound',
  'shell.sounds.subWord': 'Tap the picture you hear',
  'shell.rhyme.title': 'Rhyme Time',
  'shell.rhyme.sub': 'Tap the picture that rhymes',
  'shell.spell.title': 'Word Builder',
  'spell.hearAgain': '🔊 Tap to hear again',
  'shell.spell.sub': 'Tap the letters in order to spell the word',
  'shell.listenchoose.title': 'Listen and Choose',
  'shell.listenchoose.sub': 'Hear the word, tap the picture',
  'listenchoose.play': 'Play',
  'listenchoose.captions': 'Captions',
  'listenchoose.on': 'ON',
  'listenchoose.off': 'OFF',
  'shell.count.title': 'Count With Me',
  'shell.count.sub': 'Tap every friend, then tell me how many',
  'shell.compare.title': 'More or Less',
  'shell.compare.subMore': 'Tap the side with more',
  'shell.compare.subFewer': 'Tap the side with fewer',
  'shell.sums.title': 'Little Sums',
  'shell.sums.sub': 'See them add up, then tell me the total',
  'shell.spotit.title': 'Spot It!',
  'shell.spotit.sub': 'Tap the picture that is on BOTH cards',
  'shell.spotitDuel.title': 'Spot It! Duel',
  'shell.spotitDuel.sub': 'Each of you: find YOUR match with the middle card!',
  'shell.diff.title': 'Find the Difference',
  'shell.diff.subPicker': 'Choose a scene',
  'shell.diff.subPlay': '{name} — {n} sneaky changes!',
  'shell.hidden.title': 'Hidden Objects',
  'shell.hidden.subPicker': 'Choose a scene',
  'shell.hidden.subPlay': '{name} — can you find all of these?',
  'shell.sticker.title': 'Sticker Party',
  'shell.sticker.subPicker': 'Pick a place to decorate',
  'shell.sticker.subPlay': '{name} — decorate it your way!',
  'shell.story.title': 'Story Path',
  'shell.story.subPicker': 'Pick a story',
  'shell.memory.title': 'Memory Match',
  'shell.memory.sub': 'Find all {n} pairs',
  'shell.shadow.title': 'Shadow Match',
  'shell.shadow.sub': 'Whose shadow is this?',
  'shell.shadow.subTricky': 'Tricky! The shadow is twisted around',
  'shell.oddone.title': 'Odd One Out',
  'shell.oddone.sub': 'Find the one that does not belong',
  'shell.rules.title': 'Rule Time!',
  'shell.rules.sub': 'Do what the rule says as fast as you can',
  'shell.puzzle.title': 'Picture Puzzle',
  'shell.puzzle.subPicker': 'Choose a picture',
  'shell.puzzle.subPlay': '{name} — tap two pieces to swap them',
  'shell.musicbox.title': 'Music Box',
  'shell.musicbox.subPicker': 'Pick a song to play!',
  'shell.musicbox.subPlay': 'Tap anywhere to play the next note!',
  'shell.bingo.title': 'Picture Bingo',
  'shell.bingo.sub': 'Listen to the call and tap the picture!',
  'shell.bingo.subPhonics': 'Which picture starts with that sound?',
  'shell.carmode.title': 'Car Mode',
  'shell.carmode.sub': 'Listen, answer, and tap!',
  'shell.escape.title': 'Little Escapes',
  'shell.escape.subPicker': 'Pick a room to explore!',
  'shell.escape.subPlay': 'Search the picture — find things and use them!',
  'picker.escape': 'Which room today?',
  'escape.trayEmpty': 'Things you find go here…',

  'menu.music': 'Music Games 🎵',
  'shell.highlow.title': 'High or Low',
  'shell.highlow.sub': 'Was the second note higher or lower?',
  'shell.bells.title': 'Melody Bells',
  'shell.bells.sub': 'Listen, then play the tune back!',
  'shell.echobeat.title': 'Echo Beat',
  'shell.echobeat.sub': 'Tap the rhythm you hear!',
  'shell.steadybeat.title': 'Steady Beat',
  'shell.steadybeat.sub': 'Tap along with the beat!',
  'shell.fastslow.title': 'Fast or Slow',
  'shell.fastslow.sub': 'Is the music fast or slow?',
  'shell.samediff.title': 'Same or Different',
  'shell.samediff.sub': 'Do the two melodies match?',
  'music.listen': 'Listen...',
  'music.yourTurn': 'Your turn!',
  'music.high': 'High',
  'music.low': 'Low',
  'music.fast': 'Fast',
  'music.slow': 'Slow',
  'music.same': 'Same',
  'music.different': 'Different',

  'overlay.next': 'Next Level ▶️',
  'overlay.nextRound': 'Next Round ▶️',
  'overlay.playAgain': 'Play Again ▶️',
  'overlay.rematch': 'Rematch ▶️',
  'overlay.rematchDuel': 'Rematch ⚔️',
  'overlay.allGames': 'All Games 🏠',
  'win.diff': 'Eagle eyes! You found every difference!',
  'win.hidden': 'Super detective! You found everything!',
  'win.hiddenCoop': 'Great teamwork! You found them all together! 🦊🐰',
  'win.memory': 'Amazing memory! You matched them all!',
  'win.memoryTie': "It's a tie! You both found {n} pairs!",
  'win.memoryWinner': '{name} wins! Great game, both of you!',
  'win.shadow': 'Shadow wizard! You matched them all!',
  'win.oddone': 'Super spotter! You found them all!',
  'win.rules': 'Rule master! You followed every rule!',
  'win.puzzle': 'Puzzle master! Amazing!',
  'win.spotit': 'Sharp eyes! You spotted them all!',
  'win.spotitTimed': 'You matched them all in {time}! ⏱',
  'win.spotitDuel': '🏆 {name} wins!',
  'win.spotitDuelSub': '{emoji} {name} spotted {n} stars — great eyes!',
  'win.spotitDuelSubOne': '{emoji} {name} spotted {n} star — great eyes!',
  'win.letters': 'Letter master! You found them all!',
  'win.lettersKana': 'Kana master! You found them all!',
  'win.numbers': 'Number master! You found them all!',
  'win.sounds': 'Sound spotter! Great listening!',
  'win.soundsWords': 'Word spotter! Great listening!',
  'win.rhyme': 'Rhyme master! Great ears!',
  'win.spell': 'Great spelling! You built {n} words!',
  'win.count': 'Amazing counter! You got them all!',
  'win.compare': 'Sharp eyes! You compared like a champ!',
  'win.sums': 'Sum superstar! You added them all!',
  'win.bingo': 'BINGO! You got a line!',
  'win.musicbox': 'Beautiful music! You played the whole song!',
  'win.highlow': 'Great ears! You heard every note!',
  'win.bells': 'Bell master! You played them all back!',
  'win.echobeat': 'Rhythm star! Perfect echo!',
  'win.steadybeat': 'Steady as a drum! Great beat!',
  'win.fastslow': 'Speed detective! You got them all!',
  'win.samediff': 'Sharp ears! You heard every difference!',
  'musicbox.intro': 'Tap, tap, tap anywhere to play the song!',
  'musicbox.introFree': 'Magic keys! Every tap makes a pretty note!',
  'musicbox.freeplay': 'Magic Keys',
  'musicbox.stage': 'Stage',
  'musicbox.note': 'Music note',
  'song.twinkle': 'Twinkle Twinkle Little Star',
  'song.mary': 'Mary Had a Little Lamb',
  'song.row': 'Row Row Row Your Boat',
  'song.london': 'London Bridge',
  'song.spider': 'Itsy Bitsy Spider',
  'song.macdonald': 'Old MacDonald',
  'song.jingle': 'Jingle Bells',

  'diff.pictureA': 'Picture A',
  'diff.pictureB': 'Picture B',
  'diff.hint': '💡 Hint',
  'shadow.hint': 'Tap the sticker that makes the shadow!',
  'shadow.hintTricky': 'It might be flipped or turned — look at the shape!',
  'rules.memoryCheck': 'Memory check!',
  'rules.ruleNumber': 'Rule #{n}',
  'rules.doAgain': 'Do Rule #{n} again — remember it? 🤔',
  'rules.remind': '💡 Remind me!',
  'rules.progress': 'Found {found} of {total}',
  'puzzle.peek': '🖼️ Peek',
  'puzzle.peek.a11y': 'Peek at the finished picture',
  'puzzle.hint': 'Tap one piece, then tap another to swap them!',
  'sticker.clear': '🧹 Clear',
  'sticker.hint': 'Drag to place · pinch to resize & turn · double-tap to pop!',
  'sticker.tab.dressup': 'Dress-Up',
  'sticker.tab.characters': 'Characters',
  'sticker.tab.animals': 'Animals',
  'sticker.tab.nature': 'Nature',
  'sticker.tab.food': 'Food',
  'sticker.tab.things': 'Toys',
  'sticker.size.small': 'Small',
  'sticker.size.medium': 'Medium',
  'sticker.size.large': 'Large',
  'sticker.charactersEmpty': 'Characters coming soon! ✨',
  'memory.moves': 'Moves: {n}',
  'memory.cardFaceDown': 'face-down card',
  // Rhyme game prompts: EN interpolates {word} into the full sentence;
  // non-EN pairs this fixed question clip with the target word clip.
  'rhyme.ask': 'Which one rhymes with {word}?',
  'rhyme.comingSoon': 'More rhymes coming soon! 🎶',
  'story.tryAgain': 'Oops! Try another way ↩️',
  'story.startOver': 'Start over 📖',
  'story.readAgain': 'The End! Read again 📖',
  'story.allStories': 'All Stories 🏠',

  'feedback.chip': '💬 Send Feedback',
  'feedback.title': 'Tell us!',
  'feedback.broken': "😵 Something's broken here",
  'feedback.idea': '💡 I have an idea',
  'feedback.placeholder': 'Tell us more (optional)',
  'feedback.cancel': 'Cancel',
  'feedback.send': 'Send 📨',
  'feedback.thanks': 'Thank you! 💛',
  'gate.title': 'Parental Controls',
  'gate.holdPrompt': 'Press and hold the button below for 3 seconds to continue.',
  'gate.holdA11y': 'Hold for 3 seconds to access parental controls',
  'gate.holdButton': 'Hold here',
  'gate.cancel': 'Cancel',
  'gate.wordTitle': 'One more step',
  'gate.wordPrompt': 'To continue, type the word',
  'gate.wordPlaceholder': 'Type the word here',
  'gate.continue': 'Continue',
};

const TABLES: Record<Lang, Table> = { en: EN, ja: JA, cmn: CMN, yue: YUE };

/**
 * Look up a UI string in `lang`. Missing translations fall back to English
 * so an accidental gap never blanks the UI. If `params` is given, `{token}`
 * placeholders are interpolated verbatim (missing tokens become empty).
 */
export function t(lang: Lang, key: UIKey, params?: Record<string, string | number>): string {
  const raw = (TABLES[lang] ?? EN)[key] ?? EN[key];
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params[k];
    return v === undefined || v === null ? '' : String(v);
  });
}
