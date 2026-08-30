// Crimson Escape — homage to Toshimitsu Takagi's Crimson Room (2004).
// All game rules live in logic.ts; this component renders state and
// forwards taps. Hotspots are generous transparent Pressables layered
// over the SVG art — no pixel hunting.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameShell } from '../../components/GameShell';
import { WinOverlay } from '../../components/WinOverlay';
import { Lang } from '../../lang';
import { t } from '../../i18n';
import { sfx } from '../../sound';
import { colors, fonts, shadows } from '../../theme';
import {
  applyTap, enterCode, nextHint, selectItem, startState,
  CrimsonState, HotspotId, ItemId, Result, SAFE_CODE,
} from './logic';
import { HINT, ITEM, ITEM_EMOJI, MSG, WALL_NAME } from './text';
import { WallArt } from './scenes';

interface Props {
  onHome: () => void;
  lang?: Lang;
}

// Hotspot boxes in % of the 4:3 stage (x, y, w, h), one list per wall.
interface Spot {
  id: HotspotId;
  box: [number, number, number, number];
  label: string;
  when?: (f: CrimsonState['flags']) => boolean;
}
const SPOTS: Spot[][] = [
  [
    { id: 'pillow', box: [16, 46, 26, 16], label: 'Pillow' },
    { id: 'underBed', box: [14, 72, 72, 15], label: 'Under the bed' },
  ],
  [
    { id: 'curtains', box: [24, 12, 52, 44], label: 'Curtains' },
    { id: 'sill', box: [24, 58, 52, 12], label: 'Windowsill', when: (f) => !!f.curtainsOpen },
    { id: 'calendar', box: [4, 22, 20, 30], label: 'Calendar' },
  ],
  [
    { id: 'projector', box: [34, 14, 32, 26], label: 'Projector' },
    { id: 'topDrawer', box: [26, 43, 48, 15], label: 'Top drawer' },
    { id: 'bottomDrawer', box: [26, 58, 48, 20], label: 'Bottom drawer' },
  ],
  [
    { id: 'door', box: [28, 12, 34, 74], label: 'Door' },
    { id: 'painting', box: [66, 22, 24, 30], label: 'Painting', when: (f) => !f.paintingMoved },
    { id: 'safe', box: [65, 24, 24, 26], label: 'Safe', when: (f) => !!f.paintingMoved },
  ],
];

const CLIP_POSES = 8;
const KEY_ROWS: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', 'OK']];

export function CrimsonGame({ onHome, lang = 'en' }: Props) {
  const [s, setS] = useState<CrimsonState>(startState);
  const [view, setView] = useState(3); // wake facing the locked door
  const [caption, setCaption] = useState(MSG[lang].intro);
  const [keypad, setKeypad] = useState(false);
  const [code, setCode] = useState('');
  const [clip, setClip] = useState<number | null>(null); // pose index while the projector runs
  const clipTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width, height } = useWindowDimensions();

  // Re-render the caption in the new language, not the one it was minted in.
  const langRef = useRef(lang);
  useEffect(() => {
    if (langRef.current !== lang) {
      langRef.current = lang;
      setCaption(MSG[lang].intro);
    }
  }, [lang]);

  useEffect(() => () => { if (clipTimer.current) clearInterval(clipTimer.current); }, []);

  const run = (r: Result) => {
    setS(r.state);
    if (r.msg) setCaption(MSG[lang][r.msg]);
    if (r.sfx) sfx[r.sfx]();
    if (r.openKeypad) { setCode(''); setKeypad(true); }
    if (r.playClip) startClip();
  };

  const startClip = () => {
    setClip(0);
    let pose = 0;
    clipTimer.current = setInterval(() => {
      pose += 1;
      if (pose >= CLIP_POSES) {
        if (clipTimer.current) clearInterval(clipTimer.current);
        clipTimer.current = null;
        setClip(null);
        setCaption(MSG[langRef.current].clipDone);
        sfx.good();
      } else {
        setClip(pose);
      }
    }, 520);
  };

  const tapSpot = (id: HotspotId) => run(applyTap(s, id));
  const tapItem = (id: ItemId) => {
    const r = selectItem(s, id);
    run(r);
    if (!r.msg && r.state.selected === id) setCaption(ITEM[lang][id]);
  };
  const turn = (dir: -1 | 1) => {
    const v = (view + dir + 4) % 4;
    setView(v);
    setCaption(WALL_NAME[lang][v]);
    sfx.tap();
  };
  const pressKey = (k: string) => {
    if (k === '⌫') { setCode((c) => c.slice(0, -1)); sfx.tap(); return; }
    if (k === 'OK') {
      const r = enterCode(s, code);
      run(r);
      if (r.msg === 'codeRight') setKeypad(false);
      else setCode('');
      return;
    }
    if (code.length < SAFE_CODE.length) { setCode((c) => c + k); sfx.tap(); }
  };
  const reset = () => {
    setS(startState());
    setView(3);
    setCode('');
    setKeypad(false);
    setCaption(MSG[lang].intro);
  };

  const stageW = Math.min(width - 24, height * 0.92, 620);
  const stageH = stageW * 0.75;

  return (
    <GameShell
      title={t(lang, 'shell.crimson.title')}
      subtitle={t(lang, 'shell.crimson.sub')}
      onBack={onHome}
      lang={lang}
      right={
        <Pressable
          onPress={() => { setCaption(HINT[lang][nextHint(s)]); sfx.flip(); }}
          style={({ pressed }) => [styles.hintChip, shadows.soft, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel="Hint"
          testID="crimson-hint"
        >
          <Text style={styles.hintText}>💡</Text>
        </Pressable>
      }
    >
      <View style={styles.center}>
        <View style={[styles.stage, { width: stageW, height: stageH }]} testID="crimson-stage">
          <WallArt view={view} flags={s.flags} />
          {SPOTS[view].map((spot) =>
            spot.when && !spot.when(s.flags) ? null : (
              <Pressable
                key={spot.id}
                onPress={() => tapSpot(spot.id)}
                accessibilityRole="button"
                accessibilityLabel={spot.label}
                testID={`crimson-spot-${spot.id}`}
                style={{
                  position: 'absolute',
                  left: `${spot.box[0]}%`,
                  top: `${spot.box[1]}%`,
                  width: `${spot.box[2]}%`,
                  height: `${spot.box[3]}%`,
                }}
              />
            )
          )}
          <Pressable onPress={() => turn(-1)} style={[styles.arrow, { left: 6 }]} accessibilityRole="button" accessibilityLabel="Turn left" testID="crimson-arrow-left">
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Pressable onPress={() => turn(1)} style={[styles.arrow, { right: 6 }]} accessibilityRole="button" accessibilityLabel="Turn right" testID="crimson-arrow-right">
            <Text style={styles.arrowText}>›</Text>
          </Pressable>

          {clip !== null ? <ClipOverlay pose={clip} /> : null}

          {keypad ? (
            <View style={styles.keypadWrap} testID="crimson-keypad">
              <View style={[styles.keypadCard, shadows.soft]}>
                <View style={styles.codeRow}>
                  {Array.from({ length: SAFE_CODE.length }).map((_, i) => (
                    <View key={i} style={styles.codeCell}>
                      <Text style={styles.codeText}>{code[i] ?? '·'}</Text>
                    </View>
                  ))}
                </View>
                {KEY_ROWS.map((row) => (
                  <View key={row.join('')} style={styles.keyRow}>
                    {row.map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => pressKey(k)}
                        style={({ pressed }) => [styles.key, k === 'OK' && styles.keyOk, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel={k === '⌫' ? 'Delete' : k === 'OK' ? 'Enter code' : k}
                        testID={`crimson-key-${k === '⌫' ? 'del' : k === 'OK' ? 'ok' : k}`}
                      >
                        <Text style={[styles.keyText, k === 'OK' && styles.keyOkText]}>{k}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <Pressable onPress={() => setKeypad(false)} style={styles.keypadClose} accessibilityRole="button" accessibilityLabel="Close keypad" testID="crimson-keypad-close">
                  <Text style={styles.keypadCloseText}>✕</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.caption, { width: stageW }]}>
          <Text style={styles.captionText} testID="crimson-caption" numberOfLines={2}>
            {caption}
          </Text>
        </View>

        <View style={[styles.tray, { width: stageW }]} testID="crimson-tray">
          {s.inventory.length === 0 ? (
            <Text style={styles.trayEmpty}>· · ·</Text>
          ) : (
            s.inventory.map((item) => (
              <Pressable
                key={item}
                onPress={() => tapItem(item)}
                style={[styles.slot, s.selected === item && styles.slotSelected]}
                accessibilityRole="button"
                accessibilityLabel={ITEM.en[item]}
                testID={`crimson-item-${item}`}
              >
                <Text style={styles.slotEmoji}>{ITEM_EMOJI[item]}</Text>
              </Pressable>
            ))
          )}
        </View>
      </View>

      <WinOverlay
        visible={s.won}
        message={t(lang, 'win.crimson')}
        onNext={reset}
        onHome={onHome}
        lang={lang}
      />
    </GameShell>
  );
}

// The famous beat, reimagined: a projected silhouette dances, then points
// at the painting. Staged poses on a timer — no video assets.
function ClipOverlay({ pose }: { pose: number }) {
  const arms = [
    'M100 92 L74 76 M100 92 L126 76', // arms up
    'M100 92 L70 96 M100 92 L130 96', // T
    'M100 92 L78 116 M100 92 L124 70', // diagonal
    'M100 92 L76 70 M100 92 L124 116', // opposite diagonal
    'M100 92 L70 96 M100 92 L126 76',
    'M100 92 L74 76 M100 92 L130 96',
    'M100 92 L78 116 M100 92 L122 116', // arms down
    'M100 92 L92 112 M100 92 L146 84', // POINT →
  ];
  const legs = pose % 2 === 0 ? 'M100 128 L86 162 M100 128 L114 162' : 'M100 128 L92 164 M100 128 L120 156';
  return (
    <View style={styles.clipWrap} pointerEvents="none">
      <svg viewBox="0 0 200 200" width="70%" height="70%">
        <rect x={6} y={6} width={188} height={188} rx={8} fill="#F3E6BE" opacity={0.96} />
        <circle cx={100} cy={62} r={16} fill="#211721" />
        <path d="M100 78 L100 128" stroke="#211721" strokeWidth={10} strokeLinecap="round" />
        <path d={arms[pose % arms.length]} stroke="#211721" strokeWidth={8} strokeLinecap="round" fill="none" />
        <path d={legs} stroke="#211721" strokeWidth={8} strokeLinecap="round" fill="none" />
        {pose === arms.length - 1 ? (
          <path d="M152 84 l14 0 m-6 -6 l8 6 l-8 6" stroke="#8C2F3A" strokeWidth={4} fill="none" strokeLinecap="round" />
        ) : null}
        <rect x={6} y={6} width={188} height={188} rx={8} fill="none" stroke="#1B1B1F" strokeWidth={6} />
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  stage: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1B0B10',
    borderWidth: 4,
    borderColor: '#3A1420',
  },
  arrow: {
    position: 'absolute',
    top: '42%',
    width: 40,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(20,6,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: '#F4EBDB', fontSize: 34, lineHeight: 38, fontFamily: fonts.display },
  caption: {
    minHeight: 46,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  captionText: { color: colors.ink, fontSize: 15, fontFamily: fonts.body, textAlign: 'center' },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 58,
  },
  trayEmpty: { color: colors.inkSoft, fontSize: 18, fontFamily: fonts.body },
  slot: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  slotSelected: { borderColor: colors.gold, backgroundColor: '#FFF3D6' },
  slotEmoji: { fontSize: 26 },
  hintChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { fontSize: 20 },
  clipWrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,4,6,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadWrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,4,6,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadCard: {
    backgroundColor: '#2E2E36',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  codeCell: {
    width: 34,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#17171C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { color: '#8CE99A', fontSize: 22, fontFamily: fonts.display },
  keyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  key: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#3C3C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyOk: { backgroundColor: colors.green },
  keyText: { color: '#F4EBDB', fontSize: 18, fontFamily: fonts.body },
  keyOkText: { color: '#FFFFFF' },
  keypadClose: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadCloseText: { color: '#fff', fontSize: 16, fontFamily: fonts.body },
});
