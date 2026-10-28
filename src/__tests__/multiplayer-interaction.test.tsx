// @vitest-environment happy-dom
import React from 'react';
import { Platform, Animated } from 'react-native';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { ModePicker, useTwoPlayer, PlayerChip } from '../multiplayer';

type FakePlatform = Partial<typeof Platform>;

afterEach(cleanup);

describe('ModePicker interactions', () => {
  it("calls onPick with 'solo' when 1 Player is clicked", () => {
    const onPick = vi.fn();
    render(<ModePicker onPick={onPick} lang="en" />);
    fireEvent.click(screen.getByTestId('mp-choose-1p'));
    expect(onPick).toHaveBeenCalledWith('solo');
  });

  it("calls onPick with '2p' when 2 Players is clicked", () => {
    const onPick = vi.fn();
    render(<ModePicker onPick={onPick} lang="en" />);
    fireEvent.click(screen.getByTestId('mp-choose-2p'));
    expect(onPick).toHaveBeenCalledWith('2p');
  });
});

function TestComponent() {
  const [on, setOn] = useTwoPlayer();
  return (
    <div>
      <span data-testid="value">{on ? 'ON' : 'OFF'}</span>
      <button data-testid="toggle" onClick={() => setOn(!on)}>
        Toggle
      </button>
    </div>
  );
}

describe('useTwoPlayer hook', () => {
  let originalOS: typeof Platform.OS;

  beforeEach(() => {
    originalOS = Platform.OS;
  });

  afterEach(() => {
    (Platform as FakePlatform).OS = originalOS;
    vi.restoreAllMocks();
  });

  it('initializes from storage and updates state and storage', () => {
    (Platform as FakePlatform).OS = 'web';
    const store: Record<string, string> = { 'kgb.twoPlayer.v1': 'on' };

    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      store[key] = value;
    });

    render(<TestComponent />);
    expect(screen.getByTestId('value').textContent).toBe('ON');

    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('OFF');
    expect(store['kgb.twoPlayer.v1']).toBe('off');
  });

  it('handles localStorage errors smoothly', () => {
    (Platform as FakePlatform).OS = 'web';
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });

    render(<TestComponent />);
    expect(screen.getByTestId('value').textContent).toBe('OFF');

    expect(() => fireEvent.click(screen.getByTestId('toggle'))).not.toThrow();
    expect(screen.getByTestId('value').textContent).toBe('ON');
  });

  it('defaults to OFF on non-web platforms', () => {
    (Platform as FakePlatform).OS = 'ios';
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem');
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

    render(<TestComponent />);
    expect(screen.getByTestId('value').textContent).toBe('OFF');
    expect(getItemSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('ON');
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

describe('PlayerChip animation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers useEffect animation on count change', () => {
    const springSpy = vi.spyOn(Animated, 'spring');
    const { rerender } = render(
      <PlayerChip player={0} count={3} active={true} testID="test-chip-0" lang="en" />,
    );
    rerender(<PlayerChip player={0} count={4} active={true} testID="test-chip-0" lang="en" />);

    expect(springSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    );
  });
});
