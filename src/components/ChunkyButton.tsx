import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { fonts } from '../theme';

// Kid-app "chunky" 3D button: solid face on a darker base edge; pressing
// squashes it onto the base, releasing springs back.
export function ChunkyButton({
  label, color, darkColor, onPress, testID, minWidth = 200, fontSize = 19,
}: {
  label: string;
  color: string;
  darkColor: string;
  onPress: () => void;
  testID?: string;
  minWidth?: number;
  fontSize?: number;
}) {
  const press = useRef(new Animated.Value(0)).current;
  return (
    <Pressable
      onPressIn={() => Animated.timing(press, { toValue: 1, duration: 70, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 0, friction: 4, useNativeDriver: true }).start()}
      onPress={onPress}
      testID={testID}
      style={[styles.base, { backgroundColor: darkColor, minWidth }]}
    >
      <Animated.View
        style={[
          styles.face,
          { backgroundColor: color, minWidth },
          { transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [-5, -1] }) }] },
        ]}
      >
        <Text style={[styles.label, { fontSize }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 20, marginTop: 5 },
  face: {
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.display, color: '#fff', letterSpacing: 0.3 },
});
