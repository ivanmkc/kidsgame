import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SPOTIT_ICONS } from '../assets/images';
import { DIFFICULTIES } from '../difficulty';
import { AVATAR_CHOICES, Difficulty, MAX_PLAYERS, Player, newPlayer, savePlayers } from '../profile';
import { colors, darken, fonts, shadows } from '../theme';
import { ChunkyButton } from './ChunkyButton';

interface Props {
  players: Player[];
  onChange: (players: Player[]) => void;
  onPick: (player: Player) => void;
}

// "Who's playing?" — a card per kid: avatar, name, difficulty. Add up to 6.
export function PlayerPicker({ players, onChange, onPick }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Player>) => {
    const next = players.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onChange(next);
    savePlayers(next);
  };

  const add = () => {
    const next = [...players, newPlayer(players)];
    onChange(next);
    savePlayers(next);
  };

  const remove = (id: string) => {
    if (players.length <= 1) return;
    const next = players.filter((p) => p.id !== id);
    onChange(next);
    savePlayers(next);
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Who's playing?</Text>
      <View style={styles.row}>
        {players.map((p) => (
          <View key={p.id} style={[styles.card, shadows.sticker]}>
            {players.length > 1 ? (
              <Pressable style={styles.remove} onPress={() => remove(p.id)} testID={`player-${p.id}-remove`}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                const i = AVATAR_CHOICES.indexOf(p.avatar);
                update(p.id, { avatar: AVATAR_CHOICES[(i + 1) % AVATAR_CHOICES.length] });
              }}
              testID={`player-${p.id}-avatar`}
              style={styles.avatarWrap}
            >
              <Image source={SPOTIT_ICONS[p.avatar]} style={styles.avatar} resizeMode="contain" />
              <Text style={styles.avatarHint}>tap to change</Text>
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
              <Pressable onPress={() => setEditing(p.id)} testID={`player-${p.id}-rename`}>
                <Text style={styles.name}>{p.name} <Text style={styles.pencil}>✏️</Text></Text>
              </Pressable>
            )}
            <View style={styles.diffRow}>
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => {
                const on = p.difficulty === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => update(p.id, { difficulty: d })}
                    testID={`player-${p.id}-diff-${d}`}
                    style={[styles.diffChip, on && styles.diffChipOn]}
                  >
                    <Text style={[styles.diffText, on && styles.diffTextOn]}>
                      {DIFFICULTIES[d].emoji} {DIFFICULTIES[d].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <ChunkyButton
              label="Let's play!"
              color={colors.purple}
              darkColor={darken(colors.purple)}
              onPress={() => onPick(p)}
              testID={`player-${p.id}-play`}
              minWidth={150}
              fontSize={16}
            />
          </View>
        ))}
        {players.length < MAX_PLAYERS ? (
          <Pressable
            onPress={add}
            testID="player-add"
            style={({ pressed }) => [styles.card, styles.addCard, pressed && styles.pressed]}
          >
            <Text style={styles.addPlus}>＋</Text>
            <Text style={styles.addLabel}>Add player</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16 },
  title: { fontSize: 32, fontFamily: fonts.display, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center', maxWidth: 900 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: colors.purple,
    alignItems: 'center',
    padding: 16,
    width: 210,
    gap: 6,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 2,
    padding: 4,
  },
  removeText: { fontSize: 14, color: colors.inkSoft },
  avatarWrap: { alignItems: 'center' },
  avatar: { width: 92, height: 92 },
  avatarHint: { fontSize: 10, fontFamily: fonts.bodyReg, color: colors.inkSoft },
  name: { fontSize: 20, fontFamily: fonts.display, color: colors.ink },
  pencil: { fontSize: 13 },
  nameInput: {
    fontSize: 18,
    fontFamily: fonts.body,
    color: colors.ink,
    borderBottomWidth: 2,
    borderColor: colors.purple,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 2,
  },
  diffRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  diffChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.blush,
  },
  diffChipOn: { backgroundColor: colors.gold },
  diffText: { fontSize: 12, fontFamily: fonts.body, color: colors.inkSoft },
  diffTextOn: { color: colors.ink },
  playBtn: {
    backgroundColor: colors.purple,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    marginTop: 4,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  playText: { color: '#fff', fontFamily: fonts.display, fontSize: 17 },
  addCard: {
    borderStyle: 'dashed',
    borderColor: colors.inkSoft,
    justifyContent: 'center',
    minHeight: 240,
  },
  addPlus: { fontSize: 44, color: colors.inkSoft },
  addLabel: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15 },
});
