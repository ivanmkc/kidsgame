// Dump every line the game suites can speak -> tools/speech_lines.json
// (gen_voice.py synthesizes them; non-ASCII lines get language-tagged clips).
import { writeFileSync } from 'fs';
import { speechLines as letters } from '../src/games/letters/logic';
import { speechLines as numbers } from '../src/games/numbers/logic';
import { speechLines as sounds } from '../src/games/sounds/logic';
import { speechLines as rhyme } from '../src/games/rhymegame/logic';
import { speechLines as count } from '../src/games/count/logic';
import { speechLines as compare } from '../src/games/compare/logic';
import { speechLines as sums } from '../src/games/sums/logic';
import { speechLines as spell } from '../src/games/spell/logic';

const all = [...new Set([
  ...letters(), ...numbers(), ...sounds(), ...rhyme(),
  ...count(), ...compare(), ...sums(), ...spell(),
])].sort();
writeFileSync('tools/speech_lines.json', JSON.stringify(all, null, 1));
console.log(`dumped ${all.length} speech lines`);
