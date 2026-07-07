import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackChip } from './Feedback';
import { sfx } from '../sound';
import { Lang } from '../lang';
import { colors, fonts, shadows } from '../theme';

// "Levels" back-affordance label per language. Kept inline (rather than
// pulled through i18n.ts) because it's tightly bound to the ⬅️ chip only
// this component renders.
const BACK_LEVELS: Record<Lang, string> = {
  en: 'Levels',
  ja: 'レベル',
  cmn: '关卡',
  yue: '關卡',
};

interface Props {
  title: string;
  subtitle?: string;
  backKind?: 'menu' | 'picker'; // 🏠 to game menu vs ⬅️ back to level picker
  onBack: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Threaded to header FeedbackChip so the modal follows UI language. */
  lang?: Lang;
}

export function GameShell({ title, subtitle, onBack, right, children, backKind = 'menu', lang = 'en' }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { sfx.tap(); onBack(); }}
          style={({ pressed }) => [styles.back, shadows.soft, pressed && styles.pressed]}
          accessibilityLabel={backKind === 'picker' ? 'Back to level choices' : 'Back to menu'}
          testID="back-button"
        >
          <Text style={styles.backText}>{backKind === 'picker' ? '⬅️' : '🏠'}</Text>
          {backKind === 'picker' ? <Text style={styles.backLabel}>{BACK_LEVELS[lang]}</Text> : null}
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right}<FeedbackChip compact lang={lang} /></View>
      </View>
      {children}
    </View>
  );
}

export function ScoreChip({ label, testID }: { label: string; testID?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const prev = useRef(label);
  useEffect(() => {
    if (prev.current !== label) {
      prev.current = label;
      pulse.setValue(1.35);
      Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [label, pulse]);
  return (
    <Animated.View style={[styles.chip, shadows.soft, { transform: [{ scale: pulse }] }]}>
      <Text style={styles.chipText} testID={testID}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  back: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: { fontFamily: fonts.displayMed, fontSize: 11, color: colors.inkSoft, marginTop: -2 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  backText: { fontSize: 26 },
  titles: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontFamily: fonts.display, color: colors.ink, flexShrink: 1 },
  subtitle: { fontSize: 14, fontFamily: fonts.bodyReg, color: colors.inkSoft, marginTop: -2 },
  right: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 16, fontFamily: fonts.body, color: colors.ink },
});
