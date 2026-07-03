import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

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
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  back: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6, transform: [{ scale: 0.95 }] },
  backText: { fontSize: 26 },
  titles: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: '#888' },
  right: { minWidth: 52, alignItems: 'flex-end' },
});
