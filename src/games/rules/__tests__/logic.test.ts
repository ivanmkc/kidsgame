import { describe, expect, it } from 'vitest';
import { makeRng } from '../../../rng';
import { introPrompt, pickRuleIndex, recallPrompt, speechLines } from '../logic';

describe('pickRuleIndex', () => {
  it('easy difficulty never recalls and advances rule indices consecutively', () => {
    const rng = makeRng(12345);
    for (let idx = 0; idx < 10; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, Infinity);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
  });

  it('medium difficulty triggers recall only at round index 8 and advances consecutively', () => {
    const rng = makeRng(12345);
    for (let idx = 0; idx < 8; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 6);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }
    const recallRound = pickRuleIndex(rng, 8, 6);
    expect(recallRound.isRecall).toBe(true);
    expect(recallRound.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(recallRound.ruleIdx).toBeLessThanOrEqual(7);

    const nextRound = pickRuleIndex(rng, 9, 6);
    expect(nextRound.isRecall).toBe(false);
    expect(nextRound.ruleIdx).toBe(8);
  });

  it('hard difficulty triggers recall at rounds 5 and 8 and introduces rules consecutively', () => {
    const rng = makeRng(42);
    for (let idx = 0; idx < 5; idx++) {
      const { ruleIdx, isRecall } = pickRuleIndex(rng, idx, 3);
      expect(isRecall).toBe(false);
      expect(ruleIdx).toBe(idx);
    }

    const round5 = pickRuleIndex(rng, 5, 3);
    expect(round5.isRecall).toBe(true);
    expect(round5.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round5.ruleIdx).toBeLessThanOrEqual(4);

    const round6 = pickRuleIndex(rng, 6, 3);
    expect(round6.isRecall).toBe(false);
    expect(round6.ruleIdx).toBe(5);

    const round7 = pickRuleIndex(rng, 7, 3);
    expect(round7.isRecall).toBe(false);
    expect(round7.ruleIdx).toBe(6);

    const round8 = pickRuleIndex(rng, 8, 3);
    expect(round8.isRecall).toBe(true);
    expect(round8.ruleIdx).toBeGreaterThanOrEqual(0);
    expect(round8.ruleIdx).toBeLessThanOrEqual(6);

    const round9 = pickRuleIndex(rng, 9, 3);
    expect(round9.isRecall).toBe(false);
    expect(round9.ruleIdx).toBe(7);
  });

  it('hard mode recall rounds vary across seeds and are not locked to Rule #3', () => {
    const round5Recalled = new Set<number>();
    const round8Recalled = new Set<number>();
    let differentRecallsInSameGame = false;

    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      // Run through rounds 0..4 to advance rng state naturally
      for (let idx = 0; idx < 5; idx++) {
        pickRuleIndex(rng, idx, 3);
      }
      const r5 = pickRuleIndex(rng, 5, 3);
      expect(r5.isRecall).toBe(true);
      expect(r5.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r5.ruleIdx).toBeLessThanOrEqual(4);
      round5Recalled.add(r5.ruleIdx);

      pickRuleIndex(rng, 6, 3);
      pickRuleIndex(rng, 7, 3);

      const r8 = pickRuleIndex(rng, 8, 3);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(6);
      round8Recalled.add(r8.ruleIdx);

      if (r5.ruleIdx !== r8.ruleIdx) {
        differentRecallsInSameGame = true;
      }
    }

    // Rather than 100% ruleIndex === 2 (Rule #3), earlier rules (0 and 1) are tested
    expect(round5Recalled.size).toBeGreaterThan(1);
    expect(round5Recalled.has(0)).toBe(true);
    expect(round5Recalled.has(1)).toBe(true);
    expect(round8Recalled.size).toBeGreaterThan(1);
    expect(differentRecallsInSameGame).toBe(true);
  });

  it('medium mode recall round varies across seeds and tests earlier rules', () => {
    const recalled = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      for (let idx = 0; idx < 8; idx++) {
        pickRuleIndex(rng, idx, 6);
      }
      const r8 = pickRuleIndex(rng, 8, 6);
      expect(r8.isRecall).toBe(true);
      expect(r8.ruleIdx).toBeGreaterThanOrEqual(0);
      expect(r8.ruleIdx).toBeLessThanOrEqual(7);
      recalled.add(r8.ruleIdx);
    }
    expect(recalled.size).toBeGreaterThan(1);
    expect(recalled.has(0) || recalled.has(1)).toBe(true);
  });
});

describe('introPrompt and recallPrompt', () => {
  it('returns localized intro prompt across languages', () => {
    expect(introPrompt('en')).toBe('Rule Time! Do what the rule says as fast as you can.');
    expect(introPrompt('ja')).toBe('ルールタイム！ ルールどおりに はやく タップ！');
    expect(introPrompt('cmn')).toBe('规则时间！按规则尽快点对的图！');
    expect(introPrompt('yue')).toBe('規則時間！跟住規則盡快撳啱嘅圖！');
  });

  it('returns localized recall prompt with interpolated rule number across languages', () => {
    expect(recallPrompt('en', 3)).toBe('Memory check! Do rule number 3 again. Do you remember it?');
    expect(recallPrompt('ja', 2)).toBe('きおくクイズ！ ルール 2ばん を もういちど。 おぼえてる？');
    expect(recallPrompt('cmn', 5)).toBe('记忆挑战！再做一次第5条规则。还记得吗？');
    expect(recallPrompt('yue', 1)).toBe('記憶挑戰！再做一次第1條規則。仲記得嗎？');
  });
});

describe('speechLines', () => {
  it('is non-empty and unique', () => {
    const lines = speechLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('contains the four intro prompts and a recall prompt per lang', () => {
    const lines = speechLines();
    expect(lines).toContain('Rule Time! Do what the rule says as fast as you can.');
    expect(lines).toContain('ルールタイム！ ルールどおりに はやく タップ！');
    expect(lines).toContain('规则时间！按规则尽快点对的图！');
    expect(lines).toContain('規則時間！跟住規則盡快撳啱嘅圖！');
    expect(lines).toContain(recallPrompt('en', 1));
    expect(lines).toContain(recallPrompt('ja', 1));
    expect(lines).toContain(recallPrompt('cmn', 1));
    expect(lines).toContain(recallPrompt('yue', 1));
  });
});


