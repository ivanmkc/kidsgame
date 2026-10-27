import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CardDef } from "../menuCards";
import { Lang } from "../lang";
import { t } from "../i18n";
import { colors, fonts, shadows } from "../theme";

export function MenuCard(props: {
  g: CardDef;
  lang: Lang;
  cardWidth: number;
  onNavigate: (route: string) => void;
  preview: React.ReactNode;
}) {
  const g = props.g;
  const lang = props.lang;
  const cardWidth = props.cardWidth;
  const onNavigate = props.onNavigate;
  const preview = props.preview;

  const title = t(lang, `card.${g.key}.title` as const);
  const blurb = t(lang, `card.${g.key}.blurb` as const);
  const onPress = () => onNavigate(g.route);
  const testID = `menu-${g.route}`;

  return (
    <GameCard
      lang={lang}
      color={g.color}
      title={title}
      blurb={blurb}
      onPress={onPress}
      testID={testID}
      preview={preview}
      width={cardWidth}
      beta={g.beta}
    />
  );
}

function GameCard({
  lang,
  color,
  title,
  blurb,
  preview,
  onPress,
  testID,
  width,
  beta,
}: {
  lang: Lang;
  color: string;
  title: string;
  blurb: string;
  preview: React.ReactNode;
  onPress: () => void;
  testID: string;
  width: number;
  beta?: boolean;
}) {
  const accessibilityLabel = beta
    ? `${title} ${t(lang, "badge.beta")} — ${blurb}`
    : `${title} — ${blurb}`;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.gameCard,
        shadows.sticker,
        { borderColor: color, width },
        pressed && styles.pressed,
      ]}
    >
      {/* decorative preview: keep it out of the accessible name */}
      <View
        style={styles.previewWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {preview}
      </View>
      {beta ? (
        <View style={styles.betaBadge} testID={`${testID}-beta`}>
          <Text style={styles.betaBadgeText}>{t(lang, "badge.beta")}</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <Text style={[styles.gameTitle, { color }]}>{title}</Text>
        <Text style={styles.gameBlurb}>{blurb}</Text>
      </View>
      <View style={[styles.playBadge, { backgroundColor: color }]}>
        <Text style={styles.playBadgeText}>{t(lang, "menu.play")}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gameCard: {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 4,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  previewWrap: { height: 104, backgroundColor: colors.blush },
  betaBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(60,45,70,0.85)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  betaBadgeText: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  cardBody: { paddingHorizontal: 18, paddingVertical: 12, paddingRight: 86 },
  gameTitle: { fontSize: 22, fontFamily: fonts.display },
  gameBlurb: {
    fontSize: 13,
    fontFamily: fonts.bodyReg,
    color: colors.inkSoft,
    marginTop: 1,
  },
  playBadge: {
    position: "absolute",
    right: 14,
    bottom: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playBadgeText: {
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 1,
  },
});
