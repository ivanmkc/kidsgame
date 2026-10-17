import { renderToString } from 'react-dom/server';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SparkleBurst } from './Sparkles';

let capturedStyles: StyleProp<TextStyle>[] = [];

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Animated: {
      ...actual.Animated,
      Text: (props: { style?: StyleProp<TextStyle> }) => {
        if (props.style) {
          capturedStyles.push(props.style);
        }
        return null;
      },
    },
  };
});

describe('SparkleBurst', () => {
  beforeEach(() => {
    capturedStyles = [];
  });

  it('centres pieces at default size 16 with matching margins', () => {
    renderToString(<SparkleBurst trigger={1} size={16} />);
    expect(capturedStyles.length).toBeGreaterThan(0);
    const flat = StyleSheet.flatten(capturedStyles[0]);
    expect(flat.marginLeft).toBe(-8);
    expect(flat.marginTop).toBe(-9.6);
  });

  it('scales margins to centre pieces at custom size 26', () => {
    renderToString(<SparkleBurst trigger={1} size={26} />);
    expect(capturedStyles.length).toBeGreaterThan(0);
    const flat = StyleSheet.flatten(capturedStyles[0]);
    expect(flat.marginLeft).toBe(-13);
    expect(flat.marginTop).toBe(-15.6);
  });
});
