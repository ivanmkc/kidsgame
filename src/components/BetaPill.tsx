import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

import { Lang } from '../lang';
import { t } from '../i18n';

// Header BETA pill — parents should know a game is new. Pair with the
// menu card's `beta` badge (App.tsx CardDef.beta).
export function BetaPill({ testID = 'beta-pill', lang }: { testID?: string; lang: Lang }) {
  return (
    <View style={styles.pill} testID={testID}>
      <Text style={styles.text}>{t(lang, 'badge.beta')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: 'rgba(60,45,70,0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 44,
    justifyContent: 'center',
  },
  text: { color: colors.gold, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.5 },
});
