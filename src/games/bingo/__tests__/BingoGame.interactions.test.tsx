// @vitest-environment happy-dom
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as sound from '../../../sound';
import { sfx } from '../../../sound';
import { BingoGame } from '../BingoGame';
import * as logic from '../logic';

describe('BingoGame winning line announcement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sound, 'saySequence').mockImplementation(() => {});
    vi.spyOn(sfx, 'good').mockImplementation(() => {});
    vi.spyOn(sfx, 'wrong').mockImplementation(() => {});
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('completing a line plays confirmLines without repeating BINGO shout before useWinLine', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    const sayThenSpy = vi.spyOn(sound, 'sayThen').mockImplementation((_lines, cb) => {
      cb();
    });

    const mockBoard: logic.BingoBoard = {
      size: 3,
      cells: [
        { icon: 'apple', label: 'apple' },
        { icon: 'banana', label: 'banana' },
        { icon: 'cat', label: 'cat' },
        { icon: 'dog', label: 'dog' },
        { icon: 'elephant', label: 'elephant' },
        { icon: 'fish', label: 'fish' },
        { icon: 'guitar', label: 'guitar' },
        { icon: 'hat', label: 'hat' },
        { icon: 'icecream', label: 'ice cream' },
      ],
      calls: [
        {
          mode: 'name',
          answerIdx: 0,
          promptLines: ['Find the apple!'],
          confirmLines: ['Apple!'],
        },
        {
          mode: 'name',
          answerIdx: 1,
          promptLines: ['Find the banana!'],
          confirmLines: ['Banana!'],
        },
        {
          mode: 'name',
          answerIdx: 2,
          promptLines: ['Find the cat!'],
          confirmLines: ['Cat!'],
        },
      ],
    };

    vi.spyOn(logic, 'makeBoard').mockReturnValue(mockBoard);

    render(<BingoGame onHome={() => {}} difficulty="easy" lang="en" />);

    // Tap first matching tile (0) -> not a line yet
    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-0'));
    });
    expect(sayThenSpy).toHaveBeenLastCalledWith(['Apple!'], expect.any(Function));
    expect(saySpy).not.toHaveBeenCalled();

    // Tap second matching tile (1) -> not a line yet
    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-1'));
    });
    expect(sayThenSpy).toHaveBeenLastCalledWith(['Banana!'], expect.any(Function));
    expect(saySpy).not.toHaveBeenCalled();

    // Tap third matching tile (2) -> completes top row [0, 1, 2]
    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-2'));
    });

    // Confirmation must ONLY contain the tile confirmation lines, NOT the BINGO shout
    expect(sayThenSpy).toHaveBeenLastCalledWith(['Cat!'], expect.any(Function));
    expect(sayThenSpy.mock.calls.at(-1)?.[0]).not.toContain('BINGO!');

    // useWinLine triggers upon winLine being set and announces the victory line
    expect(saySpy).toHaveBeenCalledWith('BINGO! You got a line!');
  });

  it('completing a line in Japanese does not shout ビンゴ！ twice', () => {
    const saySpy = vi.spyOn(sound, 'say').mockImplementation(() => {});
    vi.spyOn(sound, 'sayThen').mockImplementation((_lines, cb) => {
      cb();
    });

    const mockBoard: logic.BingoBoard = {
      size: 3,
      cells: [
        { icon: 'apple', label: 'りんご' },
        { icon: 'banana', label: 'バナナ' },
        { icon: 'cat', label: 'ねこ' },
        { icon: 'dog', label: 'いぬ' },
        { icon: 'elephant', label: 'ぞう' },
        { icon: 'fish', label: 'さかな' },
        { icon: 'guitar', label: 'ギター' },
        { icon: 'hat', label: 'ぼうし' },
        { icon: 'icecream', label: 'アイスクリーム' },
      ],
      calls: [
        {
          mode: 'name',
          answerIdx: 0,
          promptLines: ['さがしてね', 'りんご！'],
          confirmLines: ['りんご！'],
        },
        {
          mode: 'name',
          answerIdx: 1,
          promptLines: ['さがしてね', 'バナナ！'],
          confirmLines: ['バナナ！'],
        },
        {
          mode: 'name',
          answerIdx: 2,
          promptLines: ['さがしてね', 'ねこ！'],
          confirmLines: ['ねこ！'],
        },
      ],
    };

    vi.spyOn(logic, 'makeBoard').mockReturnValue(mockBoard);

    render(<BingoGame onHome={() => {}} difficulty="easy" lang="ja" />);

    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-0'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-1'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('bingo-cell-2'));
    });

    // Spoken win confirmation does not contain Japanese shout ビンゴ！
    const lastConfirm = vi.mocked(sound.sayThen).mock.calls.at(-1)?.[0];
    expect(lastConfirm).toEqual(['ねこ！']);
    expect(lastConfirm).not.toContain('ビンゴ！');

    // useWinLine announces the full victory line
    expect(saySpy).toHaveBeenCalledWith('ビンゴ！ いちれつ そろったね！');
  });
});
