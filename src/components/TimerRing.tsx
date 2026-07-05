import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

// A circular progress ring: one lap = 60 seconds, lap color cycles so a
// long round stays readable. Web renders a conic-gradient (react-native-web
// passes the CSS through); native falls back to nothing — the web app is
// the shipped surface.

const LAP_COLORS = [colors.teal, colors.gold, colors.red, colors.purple];

export function useElapsed(running: boolean, resetKey: unknown = 0): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => setElapsed(0), [resetKey]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running, resetKey]);
  return elapsed;
}

export function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  elapsed: number;      // seconds
  size: number;         // outer diameter
  stroke?: number;
  style?: ViewStyle;
  showLabel?: boolean;  // mm:ss in the middle (small standalone rings)
  children?: React.ReactNode; // content wrapped by the ring (Spot-It card)
  testID?: string;
}

export function TimerRing({ elapsed, size, stroke = 8, style, showLabel, children, testID }: Props) {
  if (Platform.OS !== 'web') return <View style={style}>{children}</View>;
  const lap = Math.floor(elapsed / 60);
  const deg = ((elapsed % 60) / 60) * 360;
  const color = LAP_COLORS[lap % LAP_COLORS.length];
  const track = lap === 0 ? 'rgba(67,48,75,0.10)' : LAP_COLORS[(lap - 1) % LAP_COLORS.length];
  return (
    <View
      testID={testID}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: `conic-gradient(${color} ${deg}deg, ${track} ${deg}deg)`,
        } as any,
        style,
      ]}
    >
      <View
        style={{
          width: size - stroke * 2,
          height: size - stroke * 2,
          borderRadius: (size - stroke * 2) / 2,
          backgroundColor: colors.paper,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {children}
        {showLabel ? <Text style={styles.label}>{fmtTime(elapsed)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontVariant: ['tabular-nums'], color: colors.inkSoft, fontWeight: '600' },
});
