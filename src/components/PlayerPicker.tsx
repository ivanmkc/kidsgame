import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SPOTIT_ICONS } from '../assets/images';
import { AVATAR_CHOICES, Player, savePlayers } from '../profile';
import { colors, fonts, shadows } from '../theme';

interface Props {
  players: Player[];
  onChange: (players: Player[]) => void;
  onPick: (player: Player) => void;
}

// "Who's playing?" — big avatar cards, tap to play, long-press-free rename.
export function PlayerPicker({ players, onChange, onPick }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Player>) => {
    const next = players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onChange(next);
    savePlayers(next);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Who's playing?</Text>
      <View style={styles.row}>
        {players.map((p) => (
          <View key={p.id} style={[styles.card, shadows.sticker]}>
            <Pressable onPress={() => onPick(p)} testID={`player-${p.id}`} style={styles.avatarWrap}>
              <Image source={SPOTIT_ICONS[p.avatar]} style={styles.avatar} resizeMode="contain" />
            </Pressable>
            {editing === p.id ? (
              <TextInput
                value={p.name}
                onChangeText={(name) => update(p.id, { name })}
                onBlur={() => setEditing(null)}
                onSubmitEditing={() => setEditing(null)}
                autoFocus
                maxLength={14}
                style={styles.nameInput}
                testID={`player-${p.id}-input`}
              />
            ) : (
              <Text style={styles.name}>{p.name}</Text>
            )}
            <View style={styles.tools}>
              <Pressable onPress={() => setEditing(editing === p.id ? null : p.id)} testID={`player-${p.id}-rename`}>
                <Text style={styles.tool}>✏️</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const i = AVATAR_CHOICES.indexOf(p.avatar);
                  update(p.id, { avatar: AVATAR_CHOICES[(i + 1) % AVATAR_CHOICES.length] });
                }}
                testID={`player-${p.id}-avatar`}
              >
                <Text style={styles.tool}>🔄</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => onPick(p)}
              style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
              testID={`player-${p.id}-play`}
            >
              <Text style={styles.playText}>Let's play!</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 16 },
  title: { fontSize: 32, fontFamily: fonts.display, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.purple,
    alignItems: 'center',
    padding: 18,
    width: 190,
    gap: 8,
  },
  avatarWrap: { width: 110, height: 110 },
  avatar: { width: '100%', height: '100%' },
  name: { fontSize: 21, fontFamily: fonts.display, color: colors.ink },
  nameInput: {
    fontSize: 19,
    fontFamily: fonts.body,
    color: colors.ink,
    borderBottomWidth: 2,
    borderColor: colors.purple,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 2,
  },
  tools: { flexDirection: 'row', gap: 16 },
  tool: { fontSize: 18 },
  playBtn: {
    backgroundColor: colors.purple,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  playText: { color: '#fff', fontFamily: fonts.display, fontSize: 17 },
});
