// Not a test: a dump harness. Vitest is the one runner with the rn->rnw
// alias, so the speech-line collector runs here, gated by KGB_DUMP=1.
import { writeFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { LANGS, numberWord, HAN_NUMERALS } from '../../lang';
import { speechLines as letters } from '../letters/logic';
import { speechLines as numbers } from '../numbers/logic';
import { speechLines as sounds } from '../sounds/logic';
import { speechLines as rhyme } from '../rhymegame/logic';
import { speechLines as count } from '../count/logic';
import { speechLines as compare } from '../compare/logic';
import { speechLines as sums } from '../sums/logic';
import { speechLines as spell } from '../spell/logic';
import { speechLines as bingo } from '../bingo/logic';
import { speechLines as musicbox } from '../musicbox/logic';
import { speechLines as carmode } from '../carmode/logic';
import { speechLines as winlines } from '../winlines';

describe('speech line dump', () => {
  it('collects every suite line', () => {
    const numberLines: string[] = [];
    for (const l of LANGS) for (let n = 1; n <= 20; n++) numberLines.push(numberWord(l.id, n).t);
    const all = [...new Set([
      ...numberLines, ...HAN_NUMERALS,
      ...letters(), ...numbers(), ...sounds(), ...rhyme(),
      ...count(), ...compare(), ...sums(), ...spell(), ...bingo(), ...musicbox(), ...carmode(), ...winlines(),
    ])].sort();
    expect(all.length).toBeGreaterThan(100);
    if (process.env.KGB_DUMP === '1') {
      writeFileSync('tools/speech_lines.json', JSON.stringify(all, null, 1));
    }
  });
});
