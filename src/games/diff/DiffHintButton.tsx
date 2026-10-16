import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { colors, fonts, shadows } from '../../theme';

interface Props {
  lang: Lang;
  onPress: () => void;
}

export function DiffHintButton({ lang, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      testID="diff-hint"
      accessibilityLabel={t(lang, 'diff.hint')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.hintBtn, shadows.soft, pressed && styles.pressed]}
    >
      <Text style={styles.hintText}>{t(lang, 'diff.hint')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hintBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  hintText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
