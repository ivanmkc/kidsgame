import { describe, expect, it, vi } from 'vitest';
import * as Module from '../BingoGame';
import { sfx } from '../../../sound';

vi.mock('../../../sound', () => ({
  sfx: {
    good: vi.fn(),
    tap: vi.fn(),
    wrong: vi.fn(),
    flip: vi.fn(),
    win: vi.fn(),
    boing: vi.fn(),
    thunder: vi.fn(),
  },
  saySequence: vi.fn(),
  sayThen: vi.fn(),
  t: (lang: string, key: string) => key,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    default: {
      ...actual,
      useState: <T>(init: T | (() => T)) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
      useRef: <T>(init: T) => ({ current: init }),
      useEffect: (_cb: () => void) => {},
    },
    useState: <T>(init: T | (() => T)) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
    useRef: <T>(init: T) => ({ current: init }),
    useEffect: (_cb: () => void) => {},
  };
});

vi.mock('react-native', () => ({
  Animated: { Value: vi.fn(), sequence: vi.fn(), timing: vi.fn(), View: 'Animated.View' },
  Easing: { linear: vi.fn() },
  Image: 'Image',
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(s: T) => s },
  Text: 'Text',
  View: 'View',
  useWindowDimensions: () => ({ width: 800, height: 600 }),
}));

describe('BingoGame UI', () => {
  it('extracts onTile and ignores rapid double taps', () => {
    const props = { onHome: () => {}, difficulty: 'easy' as const, lang: 'en' as const };
    const element = Module.BingoGame(props) as React.ReactElement;
    expect(element).toBeDefined();
    
    type ViewProps = { testID?: string; children?: unknown };
    type TileProps = { onPress?: () => void };

    // Find grid
    let gridView: React.ReactElement<ViewProps> | null = null;
    const search = (node: unknown) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(search);
      } else if (typeof node === 'object' && node !== null && 'props' in node) {
        const reactNode = node as React.ReactElement<ViewProps>;
        if (reactNode.props.testID === 'bingo-grid') {
          gridView = reactNode;
        } else {
          search(reactNode.props.children);
        }
      }
    };
    search(element);
    
    expect(gridView).toBeDefined();
    
    // Call onPress
    if (gridView) {
      const gridNode = gridView as React.ReactElement<ViewProps>;
      const tiles = gridNode.props.children as React.ReactElement<TileProps>[];
      if (Array.isArray(tiles)) {
        tiles.forEach((t: React.ReactElement<TileProps>) => {
          if (t && t.props && typeof t.props.onPress === 'function') {
            // Simulate double tap
            t.props.onPress();
            t.props.onPress();
          }
        });
      }
    }

    // Since we tap every tile exactly twice, we hit the correct answer exactly once (followed by a blocked second tap).
    // The correct tile calls sfx.good() exactly once. Without the processingRef check, it would call it twice.
    expect(sfx.good).toHaveBeenCalledTimes(1);
  });
});
