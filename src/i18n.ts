import { Lang } from './lang';
import { CMN } from './i18n/cmn';
import { JA } from './i18n/ja';
import { YUE } from './i18n/yue';

// UI-text and prompt carrier phrase localization for the app (per R1).
// Vocabulary datasets (words, number names) are localized via lang.ts / words.ts.
//
// Contract:
//   t(lang, key)        → returns the translated string for `lang`.
//   t(lang, key, {..})  → same, with `{name}` placeholders interpolated.
//
// English strings must be byte-identical to what they were before this
// module existed — English mode is the untouched baseline.
export type UIKey =
  // ── Menu chrome ────────────────────────────────────────────────
  | 'menu.heading' | 'menu.word' | 'menu.number' | 'menu.grownups'
  | 'menu.section.games' | 'menu.section.word' | 'menu.section.number' | 'menu.section.music'
  | 'badge.beta' | 'menu.play'
  | 'chip.sound' | 'chip.muted'
  | 'chip.twoPlayers' | 'chip.twoPlayersOn'
  | 'a11y.langCycle' | 'a11y.diffCycle'
  | 'a11y.soundOn' | 'a11y.soundOff'
  | 'a11y.twoPlayer'
  | 'a11y.backMenu'
  | 'a11y.backPicker'
  | 'a11y.target'
  | 'a11y.targetFound'
  | 'grownups.install'
  | 'grownups.share'
  | 'grownups.copied'
  | 'grownups.feedback'
  | 'install.iosHint'
  | 'install.iosHelp'
  | 'share.copied'
  // ── Difficulty filter chip ─────────────────────────────────────
  | 'filter.all' | 'filter.easy' | 'filter.medium' | 'filter.hard'
  | 'filter.allLevels' | 'filter.easyLevels' | 'filter.mediumLevels' | 'filter.hardLevels'
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
  | 'card.wordfamily.title' | 'card.wordfamily.blurb'
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
  | 'card.cm-numdots.title' | 'card.cm-numdots.blurb'
  | 'card.cm-numhan.title'  | 'card.cm-numhan.blurb'
  | 'card.cm-shapes.title'  | 'card.cm-shapes.blurb'
  | 'card.cm-animals.title' | 'card.cm-animals.blurb'
  | 'card.cm-picword.title' | 'card.cm-picword.blurb'
  | 'card.cm-picspeak.title' | 'card.cm-picspeak.blurb'
  | 'card.cm-colors.title' | 'card.cm-colors.blurb'
  | 'card.cm-letters.title' | 'card.cm-letters.blurb'
  | 'card.cm-mixed.title' | 'card.cm-mixed.blurb'
  // ── ScenePicker surfaces ───────────────────────────────────────
  | 'picker.surprise' | 'picker.diff' | 'picker.hidden'
  | 'picker.story' | 'picker.sticker' | 'picker.puzzle'
  // ── ModePicker ─────────────────────────────────────────────────
  | 'mp.title' | 'mp.solo' | 'mp.duo'
  | 'mp.foxy' | 'mp.bunny' | 'mp.hasCount'
  | 'mp.starts' | 'mp.hasStars'
  // ── GameShell titles + subtitles ───────────────────────────────
  | 'shell.levels'
  | 'shell.letters.title'
  | 'shell.letters.titleKana'
  | 'shell.letters.subTap'
  | 'shell.letters.subSound'
  | 'shell.numbers.title'
  | 'shell.numbers.titleHan'
  | 'shell.numbers.sub'
  | 'button.switchScript'
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
  | 'shell.count.prompt'
  | 'count.praise'
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
  | 'bells.bell'
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
  | 'music.replay'
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
  | 'spotitDuel.countdown'
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
  | 'diff.pictureA' | 'diff.pictureB' | 'diff.hint'
  | 'hidden.turn' | 'hidden.prompt'
  | 'shadow.hint' | 'shadow.hintTricky'
  | 'oddone.defaultQuestion'
  | 'oddone.not.animals'
  | 'oddone.not.nature'
  | 'oddone.not.food'
  | 'oddone.not.things'
  | 'rules.memoryCheck' | 'rules.ruleNumber' | 'rules.doAgain'
  | 'rules.remind' | 'rules.progress'
  | 'puzzle.peek' | 'puzzle.peekA11y' | 'puzzle.hint' | 'puzzle.tileA11y'
  | 'sticker.clear' | 'sticker.magicFizzled' | 'sticker.magicPending'
  | 'sticker.magicLong' | 'sticker.a11yClear' | 'sticker.a11yAdd'
  | 'sticker.a11yMagic' | 'sticker.a11yTab' | 'sticker.hint'
  | 'sticker.tab.dressup' | 'sticker.tab.characters'
  | 'sticker.tab.animals' | 'sticker.tab.nature'
  | 'sticker.tab.food' | 'sticker.tab.things'
  | 'sticker.size.small' | 'sticker.size.medium' | 'sticker.size.large'
  | 'sticker.charactersEmpty'
  // ── Dress-up sticker item labels ────────────────────────────────
  | 'sticker.item.dress_pink' | 'sticker.item.dress_blue' | 'sticker.item.tutu' | 'sticker.item.crown'
  | 'sticker.item.tiara' | 'sticker.item.wizard_hat' | 'sticker.item.sun_hat' | 'sticker.item.wings_fairy'
  | 'sticker.item.wings_butterfly' | 'sticker.item.cape' | 'sticker.item.sunglasses' | 'sticker.item.bowtie'
  | 'sticker.item.necklace' | 'sticker.item.boots' | 'sticker.item.wand' | 'sticker.item.umbrella'
  | 'sticker.item.dress_rainbow' | 'sticker.item.dress_star' | 'sticker.item.dress_flower' | 'sticker.item.dress_snow'
  | 'sticker.item.kimono' | 'sticker.item.raincoat' | 'sticker.item.party_hat' | 'sticker.item.police_cap'
  | 'sticker.item.fire_helmet' | 'sticker.item.chef_hat' | 'sticker.item.cowboy_hat' | 'sticker.item.space_helmet'
  | 'sticker.item.flower_crown' | 'sticker.item.scarf' | 'sticker.item.ballet_slippers' | 'sticker.item.rain_boots'
  // ── Character sticker labels ────────────────────────────────────
  | 'sticker.character.princess_pink' | 'sticker.character.princess_blue' | 'sticker.character.prince' | 'sticker.character.knight'
  | 'sticker.character.fairy' | 'sticker.character.mermaid' | 'sticker.character.wizard' | 'sticker.character.ballerina'
  | 'sticker.character.superhero_kid' | 'sticker.character.dragon' | 'sticker.character.mounted_knight' | 'sticker.character.princess_rider'
  | 'sticker.character.queen' | 'sticker.character.police_officer' | 'sticker.character.firefighter' | 'sticker.character.doctor'
  | 'sticker.character.astronaut' | 'sticker.character.chef' | 'sticker.character.pirate' | 'sticker.character.cowgirl'
  | 'sticker.character.robot' | 'sticker.character.vet'
  | 'memory.moves' | 'memory.cardFaceDown' | 'memory.foundPair'
  | 'rhyme.ask' | 'sounds.ask' | 'rhyme.confirm' | 'rhyme.comingSoon'
  | 'letters.find' | 'letters.sound' | 'letters.findKana'
  | 'numbers.findNumber' | 'numbers.find'
  | 'bingo.prompt' | 'bingo.promptPhonics' | 'bingo.confirmPhonics'
  | 'story.tryAgain' | 'story.startOver' | 'story.readAgain' | 'story.allStories'
  | 'story.hotLead' | 'story.nextLead' | 'story.a11yFx' | 'story.a11yScare'
  | 'carmode.tap' | 'carmode.done'
  | 'carmode.pack.boops' | 'carmode.pack.rhyme' | 'carmode.pack.simon'
  | 'carmode.pack.silly' | 'carmode.pack.whoami' | 'carmode.pack.animal'
  // ── Feedback modal ─────────────────────────────────────────────
  | 'feedback.chip' | 'feedback.title' | 'feedback.broken' | 'feedback.idea'
  | 'feedback.placeholder' | 'feedback.cancel' | 'feedback.send' | 'feedback.thanks'
  // ── Adult gate ─────────────────────────────────────────────────
  | 'gate.title' | 'gate.holdPrompt' | 'gate.holdA11y' | 'gate.holdButton' | 'gate.cancel'
  | 'gate.wordTitle' | 'gate.wordPrompt' | 'gate.wordPlaceholder' | 'gate.continue'
  // ── Lockdown settings ──────────────────────────────────────────
  | 'lockdown.title'
  | 'lockdown.subtitle'
  | 'lockdown.languages'
  | 'lockdown.warning'
  | 'lockdown.done'
  | 'lockdown.doneHidden'
  // ── Colors ─────────────────────────────────────────────────────
  | 'color.red' | 'color.blue' | 'color.green' | 'color.yellow'
  | 'color.purple' | 'color.orange' | 'color.black' | 'color.white'
  | 'color.pink' | 'color.brown' | 'color.gray'
  // ── Shapes ─────────────────────────────────────────────────────
  | 'shape.circle' | 'shape.square' | 'shape.triangle' | 'shape.star'
  // ── Animals & Sounds ───────────────────────────────────────────
  | 'sound.dog' | 'sound.cat' | 'sound.lion' | 'sound.frog' | 'sound.pig'
  // ── Diff scene names ─────────────────────────────────────────────
  | 'diff.scene.farm' | 'diff.scene.ocean' | 'diff.scene.princess' | 'diff.scene.unicorn'
  | 'diff.scene.dinos' | 'diff.scene.beach' | 'diff.scene.snow' | 'diff.scene.aquarium'
  | 'diff.scene.playground' | 'diff.scene.savanna' | 'diff.scene.pirate' | 'diff.scene.trains'
  | 'diff.scene.party' | 'diff.scene.construction' | 'diff.scene.candy' | 'diff.scene.tidepool'
  | 'diff.scene.bakery' | 'diff.scene.bugs' | 'diff.scene.camping' | 'diff.scene.space'
  | 'diff.scene.music'
  // ── Hidden scene names ──────────────────────────────────────────
  | 'hidden.scene.jungle' | 'hidden.scene.ballroom' | 'hidden.scene.picnic' | 'hidden.scene.cabin'
  | 'hidden.scene.treasure' | 'hidden.scene.kitchenb' | 'hidden.scene.workshop' | 'hidden.scene.space_station'
  | 'hidden.scene.kitchen' | 'hidden.scene.fairy' | 'hidden.scene.toybox' | 'hidden.scene.dinonest'
  | 'hidden.scene.orchard' | 'hidden.scene.fairground' | 'hidden.scene.shed' | 'hidden.scene.tent'
  | 'hidden.scene.petshop' | 'hidden.scene.pond' | 'hidden.scene.depot' | 'hidden.scene.candyshop'
  | 'hidden.scene.haunted_house' | 'hidden.scene.yokai_festival' | 'hidden.scene.robot_factory' | 'hidden.scene.wizard_library'
  | 'hidden.scene.sky_market' | 'hidden.scene.coral_reef' | 'hidden.scene.spooky_graveyard' | 'hidden.scene.ice_palace'
  | 'hidden.scene.monster_bedroom' | 'hidden.scene.treehouse_village' | 'hidden.scene.dragonfly_meadow' | 'hidden.scene.cloud_kingdom'
  | 'hidden.scene.crystal_cavern' | 'hidden.scene.circus_backstage' | 'hidden.scene.mole_city' | 'hidden.scene.steampunk_airship'
  | 'hidden.scene.giant_kitchen' | 'hidden.scene.witch_kitchen'
  // ── Game-specific prompts ────────────────────────────────────────
  | 'compare.prompt.more' | 'compare.prompt.fewer' | 'compare.praise'
  | 'sums.plus' | 'sums.question' | 'sums.praise';

export type Table = Record<UIKey, string>;

// English baseline — MUST match the literal strings that were already in
// the app before i18n existed. Do not "improve" copy here; if wording
// changes, update it everywhere at once.
export const EN: Table = {
  'menu.heading': 'Kids Game Box',
  'menu.word': 'Word Games 🔤',
  'menu.number': 'Number Games 🔢',
  'menu.grownups': 'For grown-ups 🧑‍🍼',
  'menu.section.games': 'Games',
  'menu.section.word': 'Word Games',
  'menu.section.number': 'Number Games',
  'menu.section.music': 'Music Games',
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
  'a11y.target': 'Target',
  'a11y.targetFound': 'Target, found',
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
  'card.wordfamily.title': 'Word Family',
  'card.wordfamily.blurb': 'Match the sound to make a word!',
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
  'card.cm-numdots.title': 'Number Dots',
  'card.cm-numdots.blurb': 'Match numbers to the dots!',
  'card.cm-numhan.title': 'Han Numbers',
  'card.cm-numhan.blurb': 'Match numbers to Han characters!',
  'card.cm-shapes.title': 'Shape Match',
  'card.cm-shapes.blurb': 'Match shapes to everyday objects!',
  'card.cm-animals.title': 'Animal Sounds',
  'card.cm-animals.blurb': 'Match each animal to its sound!',
  'card.cm-picword.title': 'Picture & Word',
  'card.cm-picword.blurb': 'Match the picture to its word!',
  'card.cm-picspeak.title': 'Picture & Audio',
  'card.cm-picspeak.blurb': 'Match the picture to the spoken word!',
  'card.cm-colors.title': 'Colors & Words',
  'card.cm-colors.blurb': 'Match the color to its word!',
  'card.cm-letters.title': 'Letter Match',
  'card.cm-letters.blurb': 'Match big and small letters!',
  'card.cm-mixed.title': 'Mixed Match',
  'card.cm-mixed.blurb': 'Match letters, words, and colors!',

  'picker.surprise': '🎲 Surprise me!',
  'picker.diff': 'Where do you want to play?',
  'picker.hidden': 'Where do you want to search?',
  'picker.story': 'Which story shall we read?',
  'picker.sticker': "Where's the party?",
  'picker.puzzle': 'Which picture do you want to solve?',
  'mp.title': 'How many players?', 'mp.solo': '1 Player 🧒', 'mp.duo': '2 Players 👧👧',
  'mp.foxy': 'Foxy', 'mp.bunny': 'Bunny',
  'mp.hasCount': '{name} has {count}',
  'mp.starts': '{name} starts!',
  'mp.hasStars': '{name} has {n} stars',

  'shell.letters.title': 'Letter Hunt',
  'shell.levels': 'Levels',
  'shell.letters.titleKana': 'Kana Hunt',
  'shell.letters.subTap': 'Tap the letter you hear',
  'shell.letters.subSound': 'Which letter makes that sound?',
  'shell.numbers.title': 'Number Hunt',
  'shell.numbers.titleHan': 'Number Hunt (漢数字)',
  'shell.numbers.sub': 'Tap the number you hear',
  'button.switchScript': 'Switch numeral script',
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
  'shell.count.prompt': 'How many?',
  'count.praise': 'Great counting!',
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
  'bells.bell': 'Bell',
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
  'music.high': 'Higher',
  'music.low': 'Lower',
  'music.fast': 'Fast',
  'music.slow': 'Slow',
  'music.same': 'Same',
  'music.different': 'Different',
  'music.replay': 'Replay',

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
  'spotitDuel.countdown': 'Ready... Spot!',
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
  'hidden.turn': "{name}'s turn!",
  'hidden.prompt': 'Find all the hidden things!',
  'shadow.hint': 'Tap the sticker that makes the shadow!',
  'shadow.hintTricky': 'It might be flipped or turned — look at the shape!',
  'oddone.defaultQuestion': 'Which one does not belong?',
  'oddone.not.animals': 'Which one is NOT an animal?',
  'oddone.not.nature': 'Which one is NOT a flower, rainbow or star?',
  'oddone.not.food': 'Which one is NOT food?',
  'oddone.not.things': 'Which one is NOT a toy, vehicle or present?',
  'rules.memoryCheck': 'Memory check!',
  'rules.ruleNumber': 'Rule #{n}',
  'rules.doAgain': 'Do Rule #{n} again — remember it? 🤔',
  'rules.remind': '💡 Remind me!',
  'rules.progress': 'Found {found} of {total}',
  'puzzle.peek': '🖼️ Peek',
  'puzzle.peekA11y': 'Peek at the finished picture',
  'puzzle.hint': 'Tap one piece, then tap another to swap them!',
  'puzzle.tileA11y': 'Puzzle piece row {row}, column {col}',
  'sticker.clear': '🧹 Clear',
  'sticker.magicFizzled': 'The magic fizzled — try again!',
  'sticker.magicPending': 'Doing magic… ✨',
  'sticker.magicLong': 'Adding the magic touches…',
  'sticker.a11yClear': 'Clear all stickers',
  'sticker.a11yAdd': 'Add {icon} sticker',
  'sticker.a11yMagic': 'Make it real',
  'sticker.a11yTab': '{name} stickers',
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
  'sticker.item.dress_pink': 'pink dress', 'sticker.item.dress_blue': 'blue dress',
  'sticker.item.tutu': 'tutu', 'sticker.item.crown': 'crown',
  'sticker.item.tiara': 'tiara', 'sticker.item.wizard_hat': 'wizard hat',
  'sticker.item.sun_hat': 'sun hat', 'sticker.item.wings_fairy': 'fairy wings',
  'sticker.item.wings_butterfly': 'butterfly wings', 'sticker.item.cape': 'cape',
  'sticker.item.sunglasses': 'sunglasses', 'sticker.item.bowtie': 'bowtie',
  'sticker.item.necklace': 'necklace', 'sticker.item.boots': 'boots',
  'sticker.item.wand': 'wand', 'sticker.item.umbrella': 'umbrella',
  'sticker.item.dress_rainbow': 'rainbow dress', 'sticker.item.dress_star': 'star dress',
  'sticker.item.dress_flower': 'flower dress', 'sticker.item.dress_snow': 'snow dress',
  'sticker.item.kimono': 'kimono', 'sticker.item.raincoat': 'raincoat',
  'sticker.item.party_hat': 'party hat', 'sticker.item.police_cap': 'police cap',
  'sticker.item.fire_helmet': 'fire helmet', 'sticker.item.chef_hat': 'chef hat',
  'sticker.item.cowboy_hat': 'cowboy hat', 'sticker.item.space_helmet': 'space helmet',
  'sticker.item.flower_crown': 'flower crown', 'sticker.item.scarf': 'scarf',
  'sticker.item.ballet_slippers': 'ballet slippers', 'sticker.item.rain_boots': 'rain boots',
  'sticker.character.princess_pink': 'pink princess', 'sticker.character.princess_blue': 'blue princess',
  'sticker.character.prince': 'prince', 'sticker.character.knight': 'knight',
  'sticker.character.fairy': 'fairy', 'sticker.character.mermaid': 'mermaid',
  'sticker.character.wizard': 'wizard', 'sticker.character.ballerina': 'ballerina',
  'sticker.character.superhero_kid': 'superhero', 'sticker.character.dragon': 'dragon',
  'sticker.character.mounted_knight': 'mounted knight', 'sticker.character.princess_rider': 'princess rider',
  'sticker.character.queen': 'queen', 'sticker.character.police_officer': 'police officer',
  'sticker.character.firefighter': 'firefighter', 'sticker.character.doctor': 'doctor',
  'sticker.character.astronaut': 'astronaut', 'sticker.character.chef': 'chef',
  'sticker.character.pirate': 'pirate', 'sticker.character.cowgirl': 'cowgirl',
  'sticker.character.robot': 'robot', 'sticker.character.vet': 'vet',
  'memory.moves': 'Moves: {n}', 'memory.cardFaceDown': 'face-down card',
  'memory.foundPair': '{name} found a pair! Go again!',
  // Rhyme game prompts: EN interpolates {word} into the full sentence;
  // non-EN pairs this fixed question clip with the target word clip.
  'rhyme.ask': 'Which one rhymes with {word}?',
  'sounds.ask': '',
  'rhyme.confirm': 'They rhyme!',
  'rhyme.comingSoon': 'More rhymes coming soon! 🎶',
  'letters.find': 'Find the letter {letter}!',
  'letters.sound': 'Which letter says {sound}?',
  'letters.findKana': 'Find the kana {kana}!',
  'numbers.findNumber': 'Find the number {n}!',
  'numbers.find': '',
  'bingo.prompt': 'Find the {word}!',
  'bingo.promptPhonics': 'Find something that starts with {sound}!',
  'bingo.confirmPhonics': '{word} starts with {sound}!',
  'story.tryAgain': 'Oops! Try another way ↩️', 'story.startOver': 'Start over 📖',
  'story.readAgain': 'The End! Read again 📖', 'story.allStories': 'All Stories 🏠',
  'story.hotLead': 'Tap where you want to go!', 'story.nextLead': 'What should happen next?',
  'story.a11yFx': 'Something fun is here',
  'story.a11yScare': 'Something is hiding here',
  'carmode.tap': 'Tap!', 'carmode.done': 'All done!',
  'carmode.pack.boops': 'Count the Boops', 'carmode.pack.rhyme': 'Finish the Rhyme',
  'carmode.pack.simon': 'Simon Says', 'carmode.pack.silly': 'Silly or True?',
  'carmode.pack.whoami': 'Who Am I?', 'carmode.pack.animal': 'Animal Sound Safari',

  'feedback.chip': '💬 Send Feedback', 'feedback.title': 'Tell us!',
  'feedback.broken': "😵 Something's broken here", 'feedback.idea': '💡 I have an idea',
  'feedback.placeholder': 'Tell us more (optional)', 'feedback.cancel': 'Cancel',
  'feedback.send': 'Send 📨', 'feedback.thanks': 'Thank you! 💛',
  'gate.title': 'Parental Controls',
  'gate.holdPrompt': 'Press and hold the button below for 3 seconds to continue.',
  'gate.holdA11y': 'Hold for 3 seconds to access parental controls',
  'gate.holdButton': 'Hold here', 'gate.cancel': 'Cancel',
  'gate.wordTitle': 'One more step', 'gate.wordPrompt': 'To continue, type the word',
  'gate.wordPlaceholder': 'Type the word here', 'gate.continue': 'Continue',

  'lockdown.title': 'Parental Controls',
  'lockdown.subtitle': 'Toggle off games or languages to hide them from your child.',
  'lockdown.languages': 'Languages',
  'lockdown.warning': 'At least one language must remain visible.',
  'lockdown.done': 'Done',
  'lockdown.doneHidden': 'Done ({n} hidden)',

  'color.red': 'red', 'color.blue': 'blue', 'color.green': 'green', 'color.yellow': 'yellow',
  'color.purple': 'purple', 'color.orange': 'orange', 'color.black': 'black', 'color.white': 'white',
  'color.pink': 'pink', 'color.brown': 'brown', 'color.gray': 'gray',
  'shape.circle': 'circle', 'shape.square': 'square', 'shape.triangle': 'triangle', 'shape.star': 'star',
  'sound.dog': 'woof', 'sound.cat': 'meow', 'sound.lion': 'roar', 'sound.frog': 'ribbit', 'sound.pig': 'oink',

  // Diff scene names
  'diff.scene.farm': 'Farm', 'diff.scene.ocean': 'Ocean',
  'diff.scene.princess': 'Princess Castle', 'diff.scene.unicorn': 'Unicorn Meadow',
  'diff.scene.dinos': 'Dinosaur Valley', 'diff.scene.beach': 'Beach Day',
  'diff.scene.snow': 'Snowy Village', 'diff.scene.aquarium': 'Aquarium',
  'diff.scene.playground': 'Playground', 'diff.scene.savanna': 'Savanna',
  'diff.scene.pirate': 'Pirate Cove', 'diff.scene.trains': 'Train Station',
  'diff.scene.party': 'Party', 'diff.scene.construction': 'Construction Site',
  'diff.scene.candy': 'Candy Land', 'diff.scene.tidepool': 'Tide Pool',
  'diff.scene.bakery': 'Bakery', 'diff.scene.bugs': 'Bug Garden',
  'diff.scene.camping': 'Campsite', 'diff.scene.space': 'Space',
  'diff.scene.music': 'Music Room',

  // Hidden scene names
  'hidden.scene.jungle': 'Jungle', 'hidden.scene.ballroom': 'Princess Ballroom',
  'hidden.scene.picnic': 'Beach Picnic', 'hidden.scene.cabin': 'Snowy Cabin',
  'hidden.scene.treasure': 'Treasure Room', 'hidden.scene.kitchenb': 'Bakery Kitchen',
  'hidden.scene.workshop': 'Toy Workshop', 'hidden.scene.space_station': 'Space Station',
  'hidden.scene.kitchen': 'Kitchen', 'hidden.scene.fairy': 'Fairy Garden',
  'hidden.scene.toybox': 'Toy Room', 'hidden.scene.dinonest': 'Dino Nest',
  'hidden.scene.orchard': 'Apple Orchard', 'hidden.scene.fairground': 'Fairground',
  'hidden.scene.shed': 'Garden Shed', 'hidden.scene.tent': 'Inside the Tent',
  'hidden.scene.petshop': 'Pet Shop', 'hidden.scene.pond': 'Frog Pond',
  'hidden.scene.depot': 'Train Depot', 'hidden.scene.candyshop': 'Candy Shop',
  'hidden.scene.haunted_house': 'Haunted House', 'hidden.scene.yokai_festival': 'Yokai Festival',
  'hidden.scene.robot_factory': 'Robot Factory', 'hidden.scene.wizard_library': 'Wizard\'s Library',
  'hidden.scene.sky_market': 'Market in the Sky', 'hidden.scene.coral_reef': 'Coral Reef',
  'hidden.scene.spooky_graveyard': 'Spooky Graveyard', 'hidden.scene.ice_palace': 'Ice Palace',
  'hidden.scene.monster_bedroom': 'Monster\'s Bedroom', 'hidden.scene.treehouse_village': 'Treehouse Village',
  'hidden.scene.dragonfly_meadow': 'Dragonfly Meadow', 'hidden.scene.cloud_kingdom': 'Cloud Kingdom',
  'hidden.scene.crystal_cavern': 'Crystal Cavern', 'hidden.scene.circus_backstage': 'Circus Backstage',
  'hidden.scene.mole_city': 'Underground Mole City', 'hidden.scene.steampunk_airship': 'Steampunk Airship',
  'hidden.scene.giant_kitchen': 'Giant\'s Kitchen', 'hidden.scene.witch_kitchen': 'Witch\'s Kitchen',

  'compare.prompt.more': 'Tap the side with MORE!',
  'compare.prompt.fewer': 'Tap the side with FEWER!',
  'compare.praise': 'That\'s right!',

  'sums.plus': 'plus',
  'sums.question': 'How many now?',
  'sums.praise': 'That\'s right!',
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
