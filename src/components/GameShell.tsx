import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, shadows } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export function GameShell({ title, subtitle, onBack, right, children }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.back, shadows.soft, pressed && styles.pressed]}
          accessibilityLabel="Back to menu"
          testID="back-button"
        >
          <Text style={styles.backText}>🏠</Text>
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
      {children}
    </View>
  );
}

export function ScoreChip({ label, testID }: { label: string; testID?: string }) {
  return (
    <View style={[styles.chip, shadows.soft]}>
      <Text style={styles.chipText} testID={testID}>{label}</Text>
    </View>
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
  pressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  backText: { fontSize: 26 },
  titles: { flex: 1 },
  title: { fontSize: 24, fontFamily: fonts.display, color: colors.ink },
  subtitle: { fontSize: 14, fontFamily: fonts.bodyReg, color: colors.inkSoft, marginTop: -2 },
  right: { minWidth: 54, alignItems: 'flex-end' },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 16, fontFamily: fonts.body, color: colors.ink },
});
