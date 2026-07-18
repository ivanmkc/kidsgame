import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SPOTIT_ICONS } from '../../assets/images';
import { Confetti } from '../../components/Confetti';
import { GameShell, ScoreChip } from '../../components/GameShell';
import { SparkleBurst } from '../../components/Sparkles';
import { WinOverlay } from '../../components/WinOverlay';
import { Difficulty } from '../../difficulty';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { manifest } from '../../manifest';
import { makeRng } from '../../rng';
import { saySequence, sayThen, sfx } from '../../sound';
import { colors, darken, fonts, shadows } from '../../theme';
import { useWinLine } from '../winlines';
import { BingoBoard, checkBingo, bingoShout, makeBoard, settingsForBingo } from './logic';

interface Props {
  onHome: () => void;
  difficulty: Difficulty;
  lang: Lang;
}

export function BingoGame({ onHome, difficulty, lang }: Props) {
  const rngRef = useRef(makeRng(Math.floor(Math.random() * 1e9)));
  const settings = settingsForBingo(difficulty, lang);

  const [gameKey, setGameKey] = useState(0);
  const boardRef = useRef<BingoBoard>(
    makeBoard(rngRef.current, manifest.spotit.icons, settings.gridSize, settings.mode, lang),
  );
  const [callIdx, setCallIdx] = useState(0);
  const [marked, setMarked] = useState<boolean[]>(() =>
    Array(boardRef.current.cells.length).fill(false),
  );
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [winLine, setWinLine] = useState<number[] | null>(null);

  const won = winLine !== null;
  const markedCount = marked.filter(Boolean).length;
  useWinLine(won, t(lang, 'win.bingo'));

  const langMounted = useRef(false);
  useEffect(() => {
    if (!langMounted.current) { langMounted.current = true; return; }
    const s = settingsForBingo(difficulty, lang);
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    boardRef.current = makeBoard(rngRef.current, manifest.spotit.icons, s.gridSize, s.mode, lang);
    setCallIdx(0);
    setMarked(Array(boardRef.current.cells.length).fill(false));
    setWinLine(null);
    setGameKey((k) => k + 1);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const board = boardRef.current;
  const call = board.calls[callIdx];

  useEffect(() => {
    if (!won && call) saySequence(call.promptLines);
  }, [callIdx, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
  }, []);

  const onTile = (cellIdx: number) => {
    if (won || !call) return;
    if (marked[cellIdx]) return;
    if (cellIdx === call.answerIdx) {
      sfx.good();
      const next = [...marked];
      next[cellIdx] = true;
      setMarked(next);
      setCelebrate((c) => c + 1);

      const line = checkBingo(next, board.size);
      if (line) {
        sayThen([bingoShout(lang), ...call.confirmLines], () => {
          setWinLine(line);
        });
      } else {
        sayThen(call.confirmLines, () => {
          setCallIdx((i) => i + 1);
        });
      }
    } else {
      sfx.wrong();
      setWrongIdx(cellIdx);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongIdx((w) => (w === cellIdx ? null : w)), 500);
      saySequence(call.promptLines);
    }
  };

  const reset = () => {
    rngRef.current = makeRng(Math.floor(Math.random() * 1e9));
    const s = settingsForBingo(difficulty, lang);
    boardRef.current = makeBoard(rngRef.current, manifest.spotit.icons, s.gridSize, s.mode, lang);
    setCallIdx(0);
    setMarked(Array(boardRef.current.cells.length).fill(false));
    setWinLine(null);
    setWrongIdx(null);
    setGameKey((k) => k + 1);
  };

  const { width, height } = useWindowDimensions();
  const cols = board.size;
  const rows = board.size;
  const gap = 10;
  const tileSize = Math.min(
    (Math.min(width - 32, 520) - (cols - 1) * gap) / cols,
    (height - 84 - 140 - (rows - 1) * gap) / rows,
    130,
  );
  const shortH = height < 480;

  return (
    <GameShell
      title={t(lang, 'shell.bingo.title')}
      subtitle={t(lang, settings.mode === 'phonics' ? 'shell.bingo.subPhonics' : 'shell.bingo.sub')}
      onBack={onHome}
      lang={lang}
      right={<ScoreChip label={`⭐ ${markedCount}/${board.cells.length}`} testID="bingo-score" />}
    >
      <View style={[styles.board, shortH && { gap: 8 }]} key={gameKey}>
        {call && (
          <Pressable
            onPress={() => { sfx.tap(); saySequence(call.promptLines); }}
            accessibilityLabel={call.displayPrompt}
            accessibilityRole="button"
            style={({ pressed }) => [styles.prompt, shadows.soft, pressed && styles.pressed]}
            testID="bingo-prompt"
          >
            <Text style={styles.promptText}>{call.displayPrompt}</Text>
            {shortH ? null : <Text style={styles.hearHint}>{t(lang, 'spell.hearAgain')}</Text>}
          </Pressable>
        )}

        <View
          style={[styles.grid, { width: cols * tileSize + (cols - 1) * gap, gap }]}
          testID="bingo-grid"
        >
          {board.cells.map((cell, i) => (
            <BingoTile
              key={`${gameKey}-${i}`}
              icon={cell.icon}
              size={tileSize}
              marked={marked[i]}
              isWinLine={winLine?.includes(i) ?? false}
              wobble={wrongIdx === i}
              onPress={() => onTile(i)}
              sparkleKey={`${gameKey}-${i}-${marked[i]}`}
              testID={`bingo-cell-${i}`}
            />
          ))}
        </View>
      </View>
      {celebrate ? <Confetti count={18} /> : null}
      <WinOverlay
        visible={won}
        message={t(lang, 'win.bingo')}
        onNext={reset}
        nextLabel={t(lang, 'overlay.playAgain')}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

function BingoTile({
  icon, size, marked, isWinLine, wobble, onPress, sparkleKey, testID,
}: {
  icon: string;
  size: number;
  marked: boolean;
  isWinLine: boolean;
  wobble: boolean;
  onPress: () => void;
  sparkleKey: string;
  testID: string;
}) {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!wobble) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  }, [wobble, shake]);

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityLabel={icon}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tile,
          shadows.soft,
          { width: size, height: size },
          marked && styles.tileMarked,
          isWinLine && styles.tileWin,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={SPOTIT_ICONS[icon]}
          style={{ width: '72%', height: '72%' }}
          resizeMode="contain"
        />
        {marked && (
          <View style={styles.starBadge}>
            <Text style={styles.starText}>⭐</Text>
          </View>
        )}
        {marked && <SparkleBurst trigger={sparkleKey} count={5} size={12} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
    minHeight: 0,
    overflow: 'hidden',
  },
  prompt: {
    backgroundColor: '#F7EDDA',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: 'center',
    maxWidth: 520,
  },
  promptText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  hearHint: {
    fontFamily: fonts.bodyReg,
    fontSize: 12,
    color: colors.inkSoft,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMarked: {
    borderColor: colors.green,
    backgroundColor: 'rgba(95,191,110,0.14)',
  },
  tileWin: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(232,162,79,0.20)',
    borderWidth: 4,
  },
  starBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  starText: { fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
