import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { colors, shadows } from "../theme";
import { SparkleBurst } from "./Sparkles";

function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export interface FlipCardProps {
  size: number;
  up: boolean;
  matched?: boolean;
  ownerColor?: string;
  onFlip: () => void;
  renderCardFace: (size: number) => React.ReactNode;
  accessibilityLabel: string;
  testID?: string;
  sparkleTrigger?: string | number;
}

export function FlipCard({
  size,
  up,
  matched = false,
  ownerColor,
  onFlip,
  renderCardFace,
  testID,
  accessibilityLabel,
  sparkleTrigger,
}: FlipCardProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, {
      toValue: up ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [up, t]);

  const frontRot = t.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backRot = t.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  return (
    <Pressable
      onPress={onFlip}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={up || matched}
      style={{ width: size, height: size * 1.15 }}
    >
      <Animated.View
        style={[
          styles.face,
          styles.faceDown,
          shadows.soft,
          { transform: [{ perspective: 700 }, { rotateY: frontRot }] },
        ]}
      >
        <View style={styles.backRim}>
          <View style={styles.backBadge}>
            <Text style={{ fontSize: size * 0.3 }}>❓</Text>
          </View>
          <View style={[styles.backDot, { top: 7, left: 7 }]} />
          <View style={[styles.backDot, { top: 7, right: 7 }]} />
          <View style={[styles.backDot, { bottom: 7, left: 7 }]} />
          <View style={[styles.backDot, { bottom: 7, right: 7 }]} />
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.face,
          styles.faceUp,
          shadows.soft,
          matched && styles.faceMatched,
          matched && ownerColor
            ? {
                borderColor: ownerColor,
                backgroundColor: tint(ownerColor, 0.12),
              }
            : null,
          { transform: [{ perspective: 700 }, { rotateY: backRot }] },
        ]}
      >
        {renderCardFace(size)}
        {matched ? (
          <SparkleBurst trigger={sparkleTrigger ?? 1} count={5} size={13} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export interface MemoryBoardProps {
  cardCount: number;
  extraPaddingW?: number;
  extraPaddingH?: number;
  children: (cardSize: number) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function MemoryBoard({
  cardCount,
  extraPaddingW = 0,
  extraPaddingH = 64,
  children,
  style,
  testID,
}: MemoryBoardProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const count = Math.max(1, cardCount);
  const cols = isLandscape
    ? Math.max(1, Math.ceil(count / 2))
    : count <= 8
      ? 2
      : count <= 12
        ? 3
        : 4;
  const rows = Math.ceil(count / cols);
  const gap = 12;
  const availW = Math.min(width - 32, 1100) - extraPaddingW;
  const availH = height - 84 - extraPaddingH;
  const cardW = Math.max(
    0,
    Math.min(
      (availW - (cols - 1) * gap) / cols,
      (availH - (rows - 1) * gap) / rows / 1.15,
      150,
    ),
  );

  return (
    <View
      testID={testID}
      style={[
        styles.board,
        { width: cols * cardW + (cols - 1) * gap, gap },
        style,
      ]}
    >
      {children(cardW)}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  face: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  faceDown: { backgroundColor: colors.teal, padding: 5 },
  backRim: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBadge: {
    width: "58%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  backDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  faceUp: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.teal,
  },
  faceMatched: {
    borderColor: colors.green,
    backgroundColor: "rgba(95,191,110,0.12)",
  },
});
