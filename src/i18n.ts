import { Lang } from './lang';

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
  | 'chip.sound'
  | 'chip.muted'
  | 'chip.twoPlayers'
  | 'chip.twoPlayersOn'
  | 'a11y.langCycle'
  | 'a11y.diffCycle'
  | 'a11y.soundOn'
  | 'a11y.soundOff'
  | 'a11y.twoPlayer'
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
  | 'card.count.title'    | 'card.count.blurb'
  | 'card.numbers.title'  | 'card.numbers.blurb'
  | 'card.compare.title'  | 'card.compare.blurb'
  | 'card.sums.title'     | 'card.sums.blurb'
  // ── ScenePicker surfaces ───────────────────────────────────────
  | 'picker.surprise'
  | 'picker.diff'
  | 'picker.hidden'
  | 'picker.story'
  | 'picker.sticker'
  | 'picker.puzzle'
  // ── GameShell titles + subtitles ───────────────────────────────
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
  | 'puzzle.hint'
  | 'sticker.clear'
  | 'sticker.hint'
  | 'sticker.tab.dressup'
  | 'sticker.tab.animals'
  | 'sticker.tab.nature'
  | 'sticker.tab.food'
  | 'sticker.tab.things'
  | 'memory.moves'
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
  | 'feedback.thanks';

type Table = Record<UIKey, string>;

// English baseline — MUST match the literal strings that were already in
// the app before i18n existed. Do not "improve" copy here; if wording
// changes, update it everywhere at once.
const EN: Table = {
  'menu.heading': 'Kids Game Box',
  'menu.word': 'Word Games 🔤',
  'menu.number': 'Number Games 🔢',
  'menu.grownups': 'For grown-ups 🧑‍🍼',
  'chip.sound': '🔊 Sound',
  'chip.muted': '🔇 Muted',
  'chip.twoPlayers': '👯 2 Players',
  'chip.twoPlayersOn': '👯 2 Players ✓',
  'a11y.langCycle': 'Language: {name}. Tap to change',
  'a11y.diffCycle': 'Difficulty: {name}. Tap to change',
  'a11y.soundOn': 'Turn sound on',
  'a11y.soundOff': 'Turn sound off',
  'a11y.twoPlayer': 'Two player mode',
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
  'card.count.title': 'Count With Me',
  'card.count.blurb': 'Tap and count every little critter!',
  'card.numbers.title': 'Number Hunt',
  'card.numbers.blurb': 'Find the number — one, two, three!',
  'card.compare.title': 'More or Less',
  'card.compare.blurb': 'Which side has more treats?',
  'card.sums.title': 'Little Sums',
  'card.sums.blurb': 'One more hops in — how many now?',

  'picker.surprise': '🎲 Surprise me!',
  'picker.diff': 'Where do you want to play?',
  'picker.hidden': 'Where do you want to search?',
  'picker.story': 'Which story shall we read?',
  'picker.sticker': "Where's the party?",
  'picker.puzzle': 'Which picture do you want to solve?',

  'shell.letters.title': 'Letter Hunt',
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
  'puzzle.hint': 'Tap one piece, then tap another to swap them!',
  'sticker.clear': '🧹 Clear',
  'sticker.hint': 'Drag a sticker into the picture · drag to move · double-tap to pop it!',
  'sticker.tab.dressup': 'Dress-Up',
  'sticker.tab.animals': 'Animals',
  'sticker.tab.nature': 'Nature',
  'sticker.tab.food': 'Food',
  'sticker.tab.things': 'Toys',
  'memory.moves': 'Moves: {n}',
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
};

// Japanese — hiragana-forward for pre-readers with a couple of katakana
// loanwords where the borrowing is already the natural word (シール, パーティ).
const JA: Table = {
  'menu.heading': 'キッズゲームボックス',
  'menu.word': 'ことばあそび 🔤',
  'menu.number': 'すうじあそび 🔢',
  'menu.grownups': 'おうちのかたへ 🧑‍🍼',
  'chip.sound': '🔊 おと',
  'chip.muted': '🔇 むおん',
  'chip.twoPlayers': '👯 ふたりで',
  'chip.twoPlayersOn': '👯 ふたりで ✓',
  'a11y.langCycle': 'ことば: {name}。タップでかえる',
  'a11y.diffCycle': 'むずかしさ: {name}。タップでかえる',
  'a11y.soundOn': 'おとを つける',
  'a11y.soundOff': 'おとを けす',
  'a11y.twoPlayer': 'ふたりであそぶ',
  'grownups.install': '📲 ホームがめんに ついか',
  'grownups.share': '📤 ほかのかたにおしえる',
  'grownups.copied': '✅ リンクをコピーしました！',
  'grownups.feedback': '💬 ごいけん',
  'install.iosHint': 'ホームがめんについか',
  'install.iosHelp': 'きょうゆう ↑ をタップして 「ホームがめんについか」',
  'share.copied': 'リンクをコピーしました！',
  'filter.all': 'ぜんぶ',
  'filter.easy': 'やさしい',
  'filter.medium': 'ふつう',
  'filter.hard': 'むずかしい',
  'filter.allLevels': 'ぜんレベル',
  'filter.easyLevels': 'やさしい レベル',
  'filter.mediumLevels': 'ふつう レベル',
  'filter.hardLevels': 'むずかしい レベル',

  'card.spotit.title': 'いっしょさがし',
  'card.spotit.blurb': 'どちらのカードにも あるものを みつけよう',
  'card.diff.title': 'ちがいさがし',
  'card.diff.blurb': 'ふたつのえで ちがうところは？',
  'card.hidden.title': 'かくれものさがし',
  'card.hidden.blurb': 'えのなかに かくれてる ものを さがそう',
  'card.memory.title': 'しんけいすいじゃく',
  'card.memory.blurb': 'カードをめくって おなじペアを さがそう',
  'card.puzzle.title': 'えパズル',
  'card.puzzle.blurb': 'バラバラのえを もとにもどそう',
  'card.shadow.title': 'かげあわせ',
  'card.shadow.blurb': 'このかげは だれ？ あててみよう！',
  'card.oddone.title': 'なかまはずれ',
  'card.oddone.blurb': 'ひとつだけ なかまじゃないのは？',
  'card.rules.title': 'ルールタイム！',
  'card.rules.blurb': 'えいごの ルールを きいて タップ！',
  'card.rules.banner': 'どうぶつを ぜんぶ タップ！ 🐾',
  'card.sticker.title': 'シールあそび',
  'card.sticker.blurb': 'シールで えを かざろう！',
  'card.story.title': 'えほんタイム',
  'card.story.blurb': 'つぎに なにが おこる？',
  'card.letters.title': 'もじさがし',
  'card.letters.blurb': 'きこえた もじを すばやく タップ！',
  'card.sounds.title': 'はじめのおと',
  'card.sounds.blurb': 'このおとで はじまるのは どれ？',
  'card.rhyme.title': 'ライムタイム',
  'card.rhyme.blurb': 'えいごで おなじひびきの えを さがそう！',
  'card.spell.title': 'ことばづくり',
  'card.spell.blurb': 'もじを ならべて ことばを つくろう！',
  'card.count.title': 'いっしょにかぞえよう',
  'card.count.blurb': 'どうぶつを タップして かぞえよう！',
  'card.numbers.title': 'すうじさがし',
  'card.numbers.blurb': 'きこえた すうじを タップ！',
  'card.compare.title': 'どっちがおおい？',
  'card.compare.blurb': 'たくさん あるのは どっち？',
  'card.sums.title': 'たしざんタイム',
  'card.sums.blurb': 'もういっぴき ふえたら いくつ？',

  'picker.surprise': '🎲 おまかせ！',
  'picker.diff': 'どこで あそぶ？',
  'picker.hidden': 'どこで さがす？',
  'picker.story': 'どの おはなし よもうか？',
  'picker.sticker': 'パーティは どこ？',
  'picker.puzzle': 'どの えを ときたい？',

  'shell.letters.title': 'もじさがし',
  'shell.letters.titleKana': 'かなさがし',
  'shell.letters.subTap': 'きこえた もじを タップ',
  'shell.letters.subSound': 'このおとの もじは どれ？',
  'shell.numbers.title': 'すうじさがし',
  'shell.numbers.titleHan': 'すうじさがし（漢数字）',
  'shell.numbers.sub': 'きこえた すうじを タップ',
  'shell.sounds.titleEn': 'はじめのおと',
  'shell.sounds.titleWords': 'ことばさがし',
  'shell.sounds.subEn': 'このおとで はじまる えを タップ',
  'shell.sounds.subWord': 'きこえた えを タップ',
  'shell.rhyme.title': 'ライムタイム',
  'shell.rhyme.sub': 'おなじひびきの えを タップ',
  'shell.spell.title': 'ことばづくり',
  'spell.hearAgain': '🔊 タップでもういちど聞く',
  'shell.spell.sub': 'もじを じゅんばんに タップして ことばを つくろう',
  'shell.count.title': 'いっしょにかぞえよう',
  'shell.count.sub': 'みんなを タップして いくつか おしえて',
  'shell.compare.title': 'どっちがおおい？',
  'shell.compare.subMore': 'おおいほうを タップ',
  'shell.compare.subFewer': 'すくないほうを タップ',
  'shell.sums.title': 'たしざんタイム',
  'shell.sums.sub': 'たしざんして こたえを えらぼう',
  'shell.spotit.title': 'いっしょさがし',
  'shell.spotit.sub': 'りょうほうのカードに ある えを タップ',
  'shell.spotitDuel.title': 'いっしょさがし たいけつ',
  'shell.spotitDuel.sub': 'まんなかのカードと じぶんのカードで あわせよう！',
  'shell.diff.title': 'ちがいさがし',
  'shell.diff.subPicker': 'ばめんを えらぼう',
  'shell.diff.subPlay': '{name} — こっそり {n}つ ちがうよ！',
  'shell.hidden.title': 'かくれものさがし',
  'shell.hidden.subPicker': 'ばめんを えらぼう',
  'shell.hidden.subPlay': '{name} — ぜんぶ みつけられる？',
  'shell.sticker.title': 'シールあそび',
  'shell.sticker.subPicker': 'かざる ばしょを えらぼう',
  'shell.sticker.subPlay': '{name} — きみの すきに かざろう！',
  'shell.story.title': 'えほんタイム',
  'shell.story.subPicker': 'おはなしを えらぼう',
  'shell.memory.title': 'しんけいすいじゃく',
  'shell.memory.sub': '{n}くみ ぜんぶ さがそう',
  'shell.shadow.title': 'かげあわせ',
  'shell.shadow.sub': 'このかげは だれ？',
  'shell.shadow.subTricky': 'むずかしい！ かげが まわってるよ',
  'shell.oddone.title': 'なかまはずれ',
  'shell.oddone.sub': 'なかまじゃない ひとつを さがそう',
  'shell.rules.title': 'ルールタイム！',
  'shell.rules.sub': 'ルールどおりに はやく タップ！',
  'shell.puzzle.title': 'えパズル',
  'shell.puzzle.subPicker': 'えを えらぼう',
  'shell.puzzle.subPlay': '{name} — 2まいを タップして いれかえよう',

  'overlay.next': 'つぎのレベル ▶️',
  'overlay.nextRound': 'つぎのラウンド ▶️',
  'overlay.playAgain': 'もういちど ▶️',
  'overlay.rematch': 'もういっかい ▶️',
  'overlay.rematchDuel': 'もういっかい ⚔️',
  'overlay.allGames': 'メニューへ 🏠',
  'win.diff': 'すごい！ ぜんぶ みつけたね！',
  'win.hidden': 'めいたんてい！ ぜんぶ みつけたね！',
  'win.hiddenCoop': 'ちからをあわせて ぜんぶ みつけた！ 🦊🐰',
  'win.memory': 'きおくりょく ばつぐん！ ぜんぶ そろえた！',
  'win.memoryTie': 'ひきわけ！ ふたりとも {n}くみ みつけたよ！',
  'win.memoryWinner': '{name}のかち！ おたがい よくがんばった！',
  'win.shadow': 'かげはかせ！ ぜんぶ あわせたね！',
  'win.oddone': 'すごい みつけかた！ ぜんぶ せいかい！',
  'win.rules': 'ルールマスター！ ぜんぶ できたね！',
  'win.puzzle': 'パズルマスター！ すごい！',
  'win.spotit': 'めがするどい！ ぜんぶ みつけた！',
  'win.spotitTimed': '{time} で ぜんぶ あわせたよ！ ⏱',
  'win.spotitDuel': '🏆 {name}のかち！',
  'win.spotitDuelSub': '{emoji} {name}は ⭐️{n}こ！ よくみたね！',
  'win.spotitDuelSubOne': '{emoji} {name}は ⭐️{n}こ！ よくみたね！',
  'win.letters': 'もじマスター！ ぜんぶ みつけた！',
  'win.lettersKana': 'かなマスター！ ぜんぶ みつけた！',
  'win.numbers': 'すうじマスター！ ぜんぶ みつけた！',
  'win.sounds': 'みみがいいね！ よく きけたね！',
  'win.soundsWords': 'ことばはかせ！ よく きけたね！',
  'win.rhyme': 'ライムマスター！ みみが いいね！',
  'win.spell': 'すごい！ {n}こ の ことばが できた！',
  'win.count': 'かぞえかた ばつぐん！ ぜんぶ できたね！',
  'win.compare': 'めがするどい！ よくくらべたね！',
  'win.sums': 'たしざん スーパースター！ ぜんぶ せいかい！',

  'diff.pictureA': 'えA',
  'diff.pictureB': 'えB',
  'diff.hint': '💡 ヒント',
  'shadow.hint': 'このかげの もとに なる シールを タップ！',
  'shadow.hintTricky': 'まわってたり ひっくりかえってるかも — かたちを みてね！',
  'rules.memoryCheck': 'きおくクイズ！',
  'rules.ruleNumber': 'ルール #{n}',
  'rules.doAgain': 'ルール #{n} を もういちど — おぼえてる？ 🤔',
  'rules.remind': '💡 おしえて！',
  'rules.progress': '{total}こ ちゅう {found}こ',
  'puzzle.peek': '🖼️ ちらみ',
  'puzzle.hint': '1まい タップして、もう1まい タップして いれかえよう！',
  'sticker.clear': '🧹 けす',
  'sticker.hint': 'シールを えのなかへ · うごかせるよ · ダブルタップで けせるよ！',
  'sticker.tab.dressup': 'きせかえ',
  'sticker.tab.animals': 'どうぶつ',
  'sticker.tab.nature': 'しぜん',
  'sticker.tab.food': 'たべもの',
  'sticker.tab.things': 'おもちゃ',
  'memory.moves': 'てすう: {n}',
  'rhyme.comingSoon': 'ライムを もっと じゅんびちゅう！ 🎶',
  'story.tryAgain': 'あちゃ！ べつのみち ↩️',
  'story.startOver': 'はじめから 📖',
  'story.readAgain': 'おしまい！ もういちど 📖',
  'story.allStories': 'おはなし いちらん 🏠',

  'feedback.chip': '💬 ごいけん',
  'feedback.title': 'おしえて！',
  'feedback.broken': '😵 うまく うごかない',
  'feedback.idea': '💡 アイデアが あるよ',
  'feedback.placeholder': 'くわしく かいてね（にんい）',
  'feedback.cancel': 'キャンセル',
  'feedback.send': 'おくる 📨',
  'feedback.thanks': 'ありがとう！ 💛',
};

// Simplified Chinese (Mandarin, mainland conventions).
const CMN: Table = {
  'menu.heading': '儿童游戏盒',
  'menu.word': '语言游戏 🔤',
  'menu.number': '数字游戏 🔢',
  'menu.grownups': '大人专区 🧑‍🍼',
  'chip.sound': '🔊 声音',
  'chip.muted': '🔇 静音',
  'chip.twoPlayers': '👯 双人',
  'chip.twoPlayersOn': '👯 双人 ✓',
  'a11y.langCycle': '语言：{name}。点击切换',
  'a11y.diffCycle': '难度：{name}。点击切换',
  'a11y.soundOn': '打开声音',
  'a11y.soundOff': '关闭声音',
  'a11y.twoPlayer': '双人模式',
  'grownups.install': '📲 添加到主屏幕',
  'grownups.share': '📤 分享给家长',
  'grownups.copied': '✅ 已复制链接！',
  'grownups.feedback': '💬 反馈意见',
  'install.iosHint': '添加到主屏幕',
  'install.iosHelp': '点分享 ↑，然后选「添加到主屏幕」',
  'share.copied': '已复制链接！',
  'filter.all': '全部',
  'filter.easy': '简单',
  'filter.medium': '中等',
  'filter.hard': '困难',
  'filter.allLevels': '全部难度',
  'filter.easyLevels': '简单关卡',
  'filter.mediumLevels': '中等关卡',
  'filter.hardLevels': '困难关卡',

  'card.spotit.title': '找共同',
  'card.spotit.blurb': '找出两张牌上都有的那张图',
  'card.diff.title': '找不同',
  'card.diff.blurb': '两张图哪里不一样？',
  'card.hidden.title': '找隐藏',
  'card.hidden.blurb': '把藏在画里的东西找出来',
  'card.memory.title': '记忆配对',
  'card.memory.blurb': '翻牌找一样的一对',
  'card.puzzle.title': '拼图',
  'card.puzzle.blurb': '把打乱的图拼回来',
  'card.shadow.title': '影子配对',
  'card.shadow.blurb': '这是谁的影子？配一配！',
  'card.oddone.title': '找不同类',
  'card.oddone.blurb': '哪一个不是一伙的？',
  'card.rules.title': '规则时间！',
  'card.rules.blurb': '英语规则游戏 — 听规则点对的图！',
  'card.rules.banner': '点所有的动物！ 🐾',
  'card.sticker.title': '贴纸派对',
  'card.sticker.blurb': '用贴纸装饰画面！',
  'card.story.title': '故事之路',
  'card.story.blurb': '选故事下一步会怎样！',
  'card.letters.title': '找英文字母',
  'card.letters.blurb': '听到英文字母，快点找出来！',
  'card.sounds.title': '首音',
  'card.sounds.blurb': '哪张图是这个音开头的？',
  'card.rhyme.title': '押韵配对',
  'card.rhyme.blurb': '英语押韵游戏 — 找出押韵的图！',
  'card.spell.title': '拼单词',
  'card.spell.blurb': '点字母拼出单词！',
  'card.count.title': '一起数一数',
  'card.count.blurb': '点每只小动物，一起数！',
  'card.numbers.title': '找数字',
  'card.numbers.blurb': '找到数字 — 一，二，三！',
  'card.compare.title': '谁多谁少',
  'card.compare.blurb': '哪一边多？',
  'card.sums.title': '小小加法',
  'card.sums.blurb': '又来一只 — 现在几只？',

  'picker.surprise': '🎲 随机来一个！',
  'picker.diff': '想在哪玩？',
  'picker.hidden': '去哪儿找？',
  'picker.story': '读哪个故事？',
  'picker.sticker': '派对在哪？',
  'picker.puzzle': '想拼哪张图？',

  'shell.letters.title': '找英文字母',
  'shell.letters.titleKana': '找假名',
  'shell.letters.subTap': '听到英文字母就点它',
  'shell.letters.subSound': '哪个英文字母发这个音？',
  'shell.numbers.title': '找数字',
  'shell.numbers.titleHan': '找数字（汉数字）',
  'shell.numbers.sub': '听到数字就点它',
  'shell.sounds.titleEn': '首音',
  'shell.sounds.titleWords': '听词找图',
  'shell.sounds.subEn': '哪张图是这个音开头的？',
  'shell.sounds.subWord': '点你听到的图',
  'shell.rhyme.title': '押韵配对',
  'shell.rhyme.sub': '点押韵的那张图',
  'shell.spell.title': '拼单词',
  'spell.hearAgain': '🔊 点一下再听一次',
  'shell.spell.sub': '按顺序点字母拼出单词',
  'shell.count.title': '一起数一数',
  'shell.count.sub': '点每个小伙伴，然后告诉我一共几个',
  'shell.compare.title': '谁多谁少',
  'shell.compare.subMore': '点数量多的一边',
  'shell.compare.subFewer': '点数量少的一边',
  'shell.sums.title': '小小加法',
  'shell.sums.sub': '看它们加起来，然后告诉我总数',
  'shell.spotit.title': '找共同',
  'shell.spotit.sub': '点两张牌上都有的那张图',
  'shell.spotitDuel.title': '找共同 对战',
  'shell.spotitDuel.sub': '各自找出自己的牌和中间牌相同的图！',
  'shell.diff.title': '找不同',
  'shell.diff.subPicker': '选一个场景',
  'shell.diff.subPlay': '{name} — 藏了 {n} 处不同！',
  'shell.hidden.title': '找隐藏',
  'shell.hidden.subPicker': '选一个场景',
  'shell.hidden.subPlay': '{name} — 这些都能找到吗？',
  'shell.sticker.title': '贴纸派对',
  'shell.sticker.subPicker': '选个地方装饰',
  'shell.sticker.subPlay': '{name} — 随你怎么装饰！',
  'shell.story.title': '故事之路',
  'shell.story.subPicker': '选一个故事',
  'shell.memory.title': '记忆配对',
  'shell.memory.sub': '找出全部 {n} 对',
  'shell.shadow.title': '影子配对',
  'shell.shadow.sub': '这是谁的影子？',
  'shell.shadow.subTricky': '有点难！影子转过头了',
  'shell.oddone.title': '找不同类',
  'shell.oddone.sub': '找出那个不属于一伙的',
  'shell.rules.title': '规则时间！',
  'shell.rules.sub': '按规则尽快点对的图',
  'shell.puzzle.title': '拼图',
  'shell.puzzle.subPicker': '选一张图',
  'shell.puzzle.subPlay': '{name} — 点两块交换位置',

  'overlay.next': '下一关 ▶️',
  'overlay.nextRound': '下一轮 ▶️',
  'overlay.playAgain': '再玩一次 ▶️',
  'overlay.rematch': '再来一次 ▶️',
  'overlay.rematchDuel': '再对战 ⚔️',
  'overlay.allGames': '全部游戏 🏠',
  'win.diff': '火眼金睛！全都找到了！',
  'win.hidden': '超级侦探！全都找到了！',
  'win.hiddenCoop': '配合默契！你们一起找到了全部！🦊🐰',
  'win.memory': '记忆力超棒！全都配对成功！',
  'win.memoryTie': '打平啦！你们都找到 {n} 对！',
  'win.memoryWinner': '{name} 赢啦！两位都好棒！',
  'win.shadow': '影子达人！全都配对啦！',
  'win.oddone': '眼力真好！全都答对了！',
  'win.rules': '规则大师！每条都做到了！',
  'win.puzzle': '拼图大师！太厉害了！',
  'win.spotit': '眼力真尖！全都找到了！',
  'win.spotitTimed': '你用 {time} 全找对了！⏱',
  'win.spotitDuel': '🏆 {name} 赢啦！',
  'win.spotitDuelSub': '{emoji} {name} 找到 {n} 颗星 — 眼力真棒！',
  'win.spotitDuelSubOne': '{emoji} {name} 找到 {n} 颗星 — 眼力真棒！',
  'win.letters': '字母大师！全都找到了！',
  'win.lettersKana': '假名大师！全都找到了！',
  'win.numbers': '数字大师！全都找到了！',
  'win.sounds': '好耳朵！听得真准！',
  'win.soundsWords': '词汇达人！听得真准！',
  'win.rhyme': '押韵大师！耳朵好灵！',
  'win.spell': '拼写真棒！你拼出了 {n} 个单词！',
  'win.count': '数数高手！全都数对了！',
  'win.compare': '眼力真尖！比得像冠军！',
  'win.sums': '加法小超人！全都算对了！',

  'diff.pictureA': '图A',
  'diff.pictureB': '图B',
  'diff.hint': '💡 提示',
  'shadow.hint': '点出这个影子对应的贴纸！',
  'shadow.hintTricky': '可能被翻过或转过 — 看形状！',
  'rules.memoryCheck': '记忆挑战！',
  'rules.ruleNumber': '规则 #{n}',
  'rules.doAgain': '再做一次规则 #{n} — 还记得吗？🤔',
  'rules.remind': '💡 提醒我！',
  'rules.progress': '已找到 {found} / {total}',
  'puzzle.peek': '🖼️ 偷看',
  'puzzle.hint': '点一块，再点另一块，就能交换！',
  'sticker.clear': '🧹 清除',
  'sticker.hint': '把贴纸拖进画里 · 拖动可以移动 · 双击可以去掉！',
  'sticker.tab.dressup': '换装',
  'sticker.tab.animals': '动物',
  'sticker.tab.nature': '自然',
  'sticker.tab.food': '食物',
  'sticker.tab.things': '玩具',
  'memory.moves': '步数：{n}',
  'rhyme.comingSoon': '更多押韵马上就来！🎶',
  'story.tryAgain': '哎呀！换一条路 ↩️',
  'story.startOver': '重新开始 📖',
  'story.readAgain': '结束！再读一次 📖',
  'story.allStories': '所有故事 🏠',

  'feedback.chip': '💬 反馈意见',
  'feedback.title': '告诉我们！',
  'feedback.broken': '😵 这里坏掉了',
  'feedback.idea': '💡 我有一个想法',
  'feedback.placeholder': '详细说说（可选）',
  'feedback.cancel': '取消',
  'feedback.send': '发送 📨',
  'feedback.thanks': '谢谢你！💛',
};

// Traditional Chinese, colloquial HK Cantonese phrasing.
const YUE: Table = {
  'menu.heading': '小朋友遊戲盒',
  'menu.word': '文字遊戲 🔤',
  'menu.number': '數字遊戲 🔢',
  'menu.grownups': '大人專區 🧑‍🍼',
  'chip.sound': '🔊 有聲',
  'chip.muted': '🔇 靜音',
  'chip.twoPlayers': '👯 兩個人',
  'chip.twoPlayersOn': '👯 兩個人 ✓',
  'a11y.langCycle': '語言：{name}。撳一下轉',
  'a11y.diffCycle': '難度：{name}。撳一下轉',
  'a11y.soundOn': '開聲',
  'a11y.soundOff': '熄聲',
  'a11y.twoPlayer': '兩個人玩',
  'grownups.install': '📲 加去主畫面',
  'grownups.share': '📤 分享俾家長',
  'grownups.copied': '✅ 已經複製咗連結！',
  'grownups.feedback': '💬 意見',
  'install.iosHint': '加去主畫面',
  'install.iosHelp': '撳分享 ↑，再揀「加去主畫面」',
  'share.copied': '已經複製咗連結！',
  'filter.all': '全部',
  'filter.easy': '容易',
  'filter.medium': '中等',
  'filter.hard': '難',
  'filter.allLevels': '全部難度',
  'filter.easyLevels': '容易關卡',
  'filter.mediumLevels': '中等關卡',
  'filter.hardLevels': '難關卡',

  'card.spotit.title': '搵共通',
  'card.spotit.blurb': '兩張牌都有嘅係邊個？',
  'card.diff.title': '搵唔同',
  'card.diff.blurb': '兩張圖邊度唔同？',
  'card.hidden.title': '搵匿藏物',
  'card.hidden.blurb': '搵匿埋喺畫面入面嘅嘢',
  'card.memory.title': '記憶配對',
  'card.memory.blurb': '反牌搵一樣嘅一對',
  'card.puzzle.title': '砌拼圖',
  'card.puzzle.blurb': '將散開嘅圖砌返',
  'card.shadow.title': '影子配對',
  'card.shadow.blurb': '呢個影係邊個嘅？配一配！',
  'card.oddone.title': '搵唔同類',
  'card.oddone.blurb': '邊個唔係同一夥？',
  'card.rules.title': '規則時間！',
  'card.rules.blurb': '英文規則遊戲 — 聽規則撳啱嘅圖！',
  'card.rules.banner': '撳晒所有動物！ 🐾',
  'card.sticker.title': '貼紙派對',
  'card.sticker.blurb': '用貼紙裝飾幅畫！',
  'card.story.title': '故事之路',
  'card.story.blurb': '揀故事下一步！',
  'card.letters.title': '搵英文字母',
  'card.letters.blurb': '聽到英文字母，快啲撳佢！',
  'card.sounds.title': '首音',
  'card.sounds.blurb': '邊張圖係呢個音起頭？',
  'card.rhyme.title': '押韻配對',
  'card.rhyme.blurb': '英文押韻遊戲 — 揀啲押韻嘅圖！',
  'card.spell.title': '砌單字',
  'card.spell.blurb': '撳字母砌單字！',
  'card.count.title': '一齊數',
  'card.count.blurb': '撳每隻小動物，一齊數！',
  'card.numbers.title': '搵數字',
  'card.numbers.blurb': '搵到數字 — 一、二、三！',
  'card.compare.title': '邊邊多啲',
  'card.compare.blurb': '邊邊多啲嘢？',
  'card.sums.title': '加加加',
  'card.sums.blurb': '又嚟多隻 — 而家有幾多？',

  'picker.surprise': '🎲 隨機嚟一個！',
  'picker.diff': '想喺邊玩？',
  'picker.hidden': '去邊搵？',
  'picker.story': '睇邊個故事？',
  'picker.sticker': '派對喺邊？',
  'picker.puzzle': '想砌邊張圖？',

  'shell.letters.title': '搵英文字母',
  'shell.letters.titleKana': '搵假名',
  'shell.letters.subTap': '聽到英文字母就撳佢',
  'shell.letters.subSound': '邊個英文字母發呢個音？',
  'shell.numbers.title': '搵數字',
  'shell.numbers.titleHan': '搵數字（漢數字）',
  'shell.numbers.sub': '聽到數字就撳佢',
  'shell.sounds.titleEn': '首音',
  'shell.sounds.titleWords': '聽詞搵圖',
  'shell.sounds.subEn': '邊張圖係呢個音起頭？',
  'shell.sounds.subWord': '撳你聽到嘅圖',
  'shell.rhyme.title': '押韻配對',
  'shell.rhyme.sub': '撳押韻嗰張圖',
  'shell.spell.title': '砌單字',
  'spell.hearAgain': '🔊 撳一下再聽一次',
  'shell.spell.sub': '順住次序撳字母，砌返個單字',
  'shell.count.title': '一齊數',
  'shell.count.sub': '撳每個朋友仔，然後話俾我聽有幾多個',
  'shell.compare.title': '邊邊多啲',
  'shell.compare.subMore': '撳多啲嗰邊',
  'shell.compare.subFewer': '撳少啲嗰邊',
  'shell.sums.title': '加加加',
  'shell.sums.sub': '睇佢哋加埋，然後話俾我聽總數',
  'shell.spotit.title': '搵共通',
  'shell.spotit.sub': '撳兩張牌都有嗰張圖',
  'shell.spotitDuel.title': '搵共通 對戰',
  'shell.spotitDuel.sub': '各自搵你嗰張牌同中間牌一樣嗰個圖！',
  'shell.diff.title': '搵唔同',
  'shell.diff.subPicker': '揀個場景',
  'shell.diff.subPlay': '{name} — 匿咗 {n} 處唔同！',
  'shell.hidden.title': '搵匿藏物',
  'shell.hidden.subPicker': '揀個場景',
  'shell.hidden.subPlay': '{name} — 呢啲全部搵到？',
  'shell.sticker.title': '貼紙派對',
  'shell.sticker.subPicker': '揀個地方裝飾',
  'shell.sticker.subPlay': '{name} — 隨你點樣裝飾！',
  'shell.story.title': '故事之路',
  'shell.story.subPicker': '揀個故事',
  'shell.memory.title': '記憶配對',
  'shell.memory.sub': '搵晒 {n} 對',
  'shell.shadow.title': '影子配對',
  'shell.shadow.sub': '呢個影係邊個嘅？',
  'shell.shadow.subTricky': '有啲難！個影轉咗頭',
  'shell.oddone.title': '搵唔同類',
  'shell.oddone.sub': '搵嗰個唔係同一夥',
  'shell.rules.title': '規則時間！',
  'shell.rules.sub': '跟住規則盡快撳啱嘅圖',
  'shell.puzzle.title': '砌拼圖',
  'shell.puzzle.subPicker': '揀張圖',
  'shell.puzzle.subPlay': '{name} — 撳兩塊調位',

  'overlay.next': '下一關 ▶️',
  'overlay.nextRound': '下一輪 ▶️',
  'overlay.playAgain': '再玩一次 ▶️',
  'overlay.rematch': '再嚟一次 ▶️',
  'overlay.rematchDuel': '再對戰 ⚔️',
  'overlay.allGames': '全部遊戲 🏠',
  'win.diff': '火眼金睛！全部搵晒！',
  'win.hidden': '超級偵探！全部搵晒！',
  'win.hiddenCoop': '合作無間！大家一齊搵晒！🦊🐰',
  'win.memory': '記憶力好勁！全部配對到！',
  'win.memoryTie': '打和！大家都搵到 {n} 對！',
  'win.memoryWinner': '{name} 贏咗！兩個都好叻！',
  'win.shadow': '影子高手！全部配對到！',
  'win.oddone': '眼力好勁！全部啱晒！',
  'win.rules': '規則大師！每條都做到！',
  'win.puzzle': '拼圖大師！好勁呀！',
  'win.spotit': '眼力好尖！全部搵到！',
  'win.spotitTimed': '你用 {time} 全部搵晒！⏱',
  'win.spotitDuel': '🏆 {name} 贏咗！',
  'win.spotitDuelSub': '{emoji} {name} 搵到 {n} 粒星 — 眼力好勁！',
  'win.spotitDuelSubOne': '{emoji} {name} 搵到 {n} 粒星 — 眼力好勁！',
  'win.letters': '字母大師！全部搵到！',
  'win.lettersKana': '假名大師！全部搵到！',
  'win.numbers': '數字大師！全部搵到！',
  'win.sounds': '好耳仔！聽得好準！',
  'win.soundsWords': '詞彙達人！聽得好準！',
  'win.rhyme': '押韻大師！耳仔好靈！',
  'win.spell': '砌字好勁！你砌咗 {n} 個字！',
  'win.count': '數數高手！全部數啱！',
  'win.compare': '眼力好尖！比得好叻！',
  'win.sums': '加法小超人！全部計啱！',

  'diff.pictureA': '圖A',
  'diff.pictureB': '圖B',
  'diff.hint': '💡 提示',
  'shadow.hint': '撳呢個影對應嘅貼紙！',
  'shadow.hintTricky': '可能反轉或者轉咗 — 睇形狀！',
  'rules.memoryCheck': '記憶挑戰！',
  'rules.ruleNumber': '規則 #{n}',
  'rules.doAgain': '再做一次規則 #{n} — 仲記得嗎？🤔',
  'rules.remind': '💡 提我！',
  'rules.progress': '搵到 {found} / {total}',
  'puzzle.peek': '🖼️ 偷睇',
  'puzzle.hint': '撳一塊，再撳另一塊，就會調位！',
  'sticker.clear': '🧹 清除',
  'sticker.hint': '將貼紙拖入畫面 · 拖動可以搬 · 連撳兩下可以除走！',
  'sticker.tab.dressup': '換裝',
  'sticker.tab.animals': '動物',
  'sticker.tab.nature': '大自然',
  'sticker.tab.food': '食物',
  'sticker.tab.things': '玩具',
  'memory.moves': '步數：{n}',
  'rhyme.comingSoon': '更多押韻就快嚟！🎶',
  'story.tryAgain': '咦！行第二條路 ↩️',
  'story.startOver': '由頭嚟過 📖',
  'story.readAgain': '完！再睇一次 📖',
  'story.allStories': '所有故事 🏠',

  'feedback.chip': '💬 意見',
  'feedback.title': '話俾我哋知！',
  'feedback.broken': '😵 呢度壞咗',
  'feedback.idea': '💡 我有個諗法',
  'feedback.placeholder': '講多啲（可以唔填）',
  'feedback.cancel': '取消',
  'feedback.send': '傳送 📨',
  'feedback.thanks': '多謝！💛',
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
