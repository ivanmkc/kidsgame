import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Lang } from "../lang";
import { t } from "../i18n";
import { LangContext } from "./GameShell";
import { randomGateWord } from "../lockdown";
import { colors, fonts } from "../theme";

interface Props {
  onPass: () => void;
  onCancel: () => void;
  lang?: Lang;
}

type Phase = "hold" | "word";

const HOLD_MS = 3000;
const IDLE_TIMEOUT_MS = 30000;

export function AdultGate({ onPass, onCancel, lang: propLang }: Props) {
  const langCtx = useContext(LangContext);
  const lang = propLang ?? langCtx?.lang ?? "en";
  const [phase, setPhase] = useState<Phase>("hold");
  const [holdProgress, setHoldProgress] = useState(0);
  const [word, setWord] = useState(() => randomGateWord(lang));
  const [typed, setTyped] = useState("");
  const [_shake, setShake] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef<number>(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const prevLangRef = useRef(lang);

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => onCancel(), IDLE_TIMEOUT_MS);
  }, [onCancel]);

  useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setWord(randomGateWord(lang));
      setTyped("");
    }
  }, [lang]);

  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, [resetIdle]);

  const onHoldStart = () => {
    resetIdle();
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        setPhase("word");
        resetIdle();
      }
    }, 50);
  };

  const onHoldEnd = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setHoldProgress(0);
  };

  const onSubmit = () => {
    resetIdle();
    if (typed.trim().toLowerCase() === word.toLowerCase()) {
      onPass();
    } else {
      setShake(true);
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start(() => setShake(false));
      setTyped("");
      setWord(randomGateWord(lang));
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        {phase === "hold" ? (
          <>
            <Text style={styles.title}>{t(lang, "gate.title")}</Text>
            <Text style={styles.body}>{t(lang, "gate.holdPrompt")}</Text>
            <Pressable
              onPressIn={onHoldStart}
              onPressOut={onHoldEnd}
              style={styles.holdBtn}
              accessibilityLabel={t(lang, "gate.holdA11y")}
            >
              <View style={styles.holdTrack}>
                <View
                  style={[styles.holdFill, { width: `${holdProgress * 100}%` }]}
                />
              </View>
              <Text style={styles.holdText}>
                {holdProgress > 0
                  ? `${Math.round(holdProgress * 100)}%`
                  : t(lang, "gate.holdButton")}
              </Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t(lang, "gate.cancel")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>{t(lang, "gate.wordTitle")}</Text>
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <Text style={styles.body}>
                {t(lang, "gate.wordPrompt")}{" "}
                <Text style={styles.wordHighlight}>{word}</Text>
              </Text>
              <TextInput
                value={typed}
                onChangeText={(text) => {
                  setTyped(text);
                  resetIdle();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                style={styles.input}
                placeholder={t(lang, "gate.wordPlaceholder")}
                placeholderTextColor={colors.inkSoft}
                testID="gate-input"
                onSubmitEditing={onSubmit}
                returnKeyType="done"
              />
            </Animated.View>
            <View style={styles.btnRow}>
              <Pressable onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t(lang, "gate.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                style={[
                  styles.submitBtn,
                  !typed.trim() && styles.submitDisabled,
                ]}
                disabled={!typed.trim()}
                testID="gate-submit"
              >
                <Text style={styles.submitText}>
                  {t(lang, "gate.continue")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
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
  card: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: 28,
    width: "90%",
    maxWidth: 380,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.bodyReg,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: "center",
    lineHeight: 22,
  },
  wordHighlight: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.teal,
  },
  holdBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.blush,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  holdTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
  holdFill: {
    height: "100%",
    backgroundColor: colors.teal,
    borderRadius: 16,
  },
  holdText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    zIndex: 1,
  },
  input: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.blush,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
    marginTop: 12,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.blush,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
  },
  submitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: colors.teal,
    minHeight: 44,
    justifyContent: "center",
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: "#fff",
  },
});
