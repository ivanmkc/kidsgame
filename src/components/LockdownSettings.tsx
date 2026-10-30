import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Lang, LANGS } from "../lang";
import { colors, fonts, shadows } from "../theme";
import { LangContext } from "./GameShell";
import { buildGameSections, countHidden } from "../menuCards";
import { t } from "../i18n";

interface Props {
  hiddenGames: string[];
  hiddenLangs: string[];
  onToggleGame: (id: string) => void;
  onToggleLang: (lang: Lang) => boolean;
  onDone: () => void;
}

export function LockdownSettings({
  hiddenGames,
  hiddenLangs,
  onToggleGame,
  onToggleLang,
  onDone,
}: Props) {
  const langCtx = useContext(LangContext);
  const lang = langCtx?.lang ?? "en";
  const sections = buildGameSections(lang);
  const [langWarning, setLangWarning] = useState(false);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  const handleLangToggle = (lang: Lang) => {
    const ok = onToggleLang(lang);
    if (!ok) {
      setLangWarning(true);
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      warningTimerRef.current = setTimeout(() => {
        setLangWarning(false);
        warningTimerRef.current = null;
      }, 2500);
    }
  };

  const totalHidden = countHidden(hiddenGames, hiddenLangs);

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>{t(lang, "lockdown.title")}</Text>
        <Text style={styles.subtitle}>{t(lang, "lockdown.subtitle")}</Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.games.map((game) => {
                const hidden = hiddenGames.includes(game.id);
                return (
                  <Pressable
                    key={game.id}
                    style={styles.row}
                    onPress={() => onToggleGame(game.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !hidden }}
                    accessibilityLabel={game.label}
                    testID={`lock-row-game-${game.id}`}
                  >
                    <Text
                      style={[styles.rowLabel, hidden && styles.rowLabelOff]}
                    >
                      {game.label}
                    </Text>
                    <View pointerEvents="none">
                      <Switch
                        value={!hidden}
                        trackColor={{ false: "#ddd", true: colors.teal }}
                        thumbColor={colors.card}
                        testID={`lock-game-${game.id}`}
                        aria-hidden={true}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t(lang, "lockdown.languages")}
            </Text>
            {langWarning && (
              <Text style={styles.warning}>{t(lang, "lockdown.warning")}</Text>
            )}
            {LANGS.map((lang) => {
              const hidden = hiddenLangs.includes(lang.id);
              return (
                <Pressable
                  key={lang.id}
                  style={styles.row}
                  onPress={() => handleLangToggle(lang.id)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !hidden }}
                  accessibilityLabel={`${lang.emoji} ${lang.label}`}
                  testID={`lock-row-lang-${lang.id}`}
                >
                  <Text style={[styles.rowLabel, hidden && styles.rowLabelOff]}>
                    {lang.emoji} {lang.label}
                  </Text>
                  <View pointerEvents="none">
                    <Switch
                      value={!hidden}
                      trackColor={{ false: "#ddd", true: colors.teal }}
                      thumbColor={colors.card}
                      testID={`lock-lang-${lang.id}`}
                      aria-hidden={true}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          onPress={onDone}
          style={styles.doneBtn}
          testID="lockdown-done"
        >
          <Text style={styles.doneText}>
            {totalHidden > 0
              ? t(lang, "lockdown.doneHidden", { n: totalHidden })
              : t(lang, "lockdown.done")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  panel: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: 24,
    width: "92%",
    maxWidth: 420,
    maxHeight: "85%",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.bodyReg,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: "center",
    marginBottom: 12,
  },
  scroll: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.blush,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    flex: 1,
  },
  rowLabelOff: {
    color: colors.inkSoft,
    textDecorationLine: "line-through",
  },
  warning: {
    fontFamily: fonts.bodyReg,
    fontSize: 13,
    color: colors.red,
    marginBottom: 6,
  },
  doneBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: colors.teal,
    minHeight: 44,
    justifyContent: "center",
    ...shadows.soft,
  },
  doneText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: "#fff",
  },
});
