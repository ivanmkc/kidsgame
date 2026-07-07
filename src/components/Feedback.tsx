import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { track } from '../analytics';
import { Lang } from '../lang';
import { t } from '../i18n';
import { sfx } from '../sound';
import { colors, fonts, shadows } from '../theme';

// Parent feedback: one tap to flag "this screen is broken" or share an
// idea, with optional text. Lands in the analytics beacon (event
// 'feedback') with the current route attached — no accounts, no forms.
export function FeedbackChip({ compact, lang = 'en' }: { compact?: boolean; lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'broken' | 'idea' | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  const reset = () => { setOpen(false); setKind(null); setText(''); setSent(false); };
  const send = () => {
    track('feedback', {
      kind: kind ?? 'idea',
      text: text.trim().slice(0, 500),
      route: typeof window !== 'undefined' ? window.location.hash || '#/' : '',
    });
    sfx.good();
    setSent(true);
    setTimeout(reset, 1400);
  };

  return (
    <>
      <Pressable
        onPress={() => { sfx.tap(); setOpen(true); }}
        testID="feedback-open"
        accessibilityRole="button"
        accessibilityLabel={t(lang, 'feedback.chip')}
        style={({ pressed }) => [compact ? styles.chipCompact : styles.chip, pressed && { opacity: 0.75 }]}
      >
        <Text style={compact ? styles.chipCompactText : styles.chipText}>{compact ? '💬' : t(lang, 'feedback.chip')}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={reset}>
        <View style={styles.scrim}>
          <View style={[styles.card, shadows.sticker]}>
            {sent ? (
              <Text style={styles.title}>{t(lang, 'feedback.thanks')}</Text>
            ) : (
              <>
                <Text style={styles.title}>{t(lang, 'feedback.title')}</Text>
                <View style={styles.kinds}>
                  <Pressable
                    onPress={() => { sfx.tap(); setKind('broken'); }}
                    testID="feedback-broken"
                    style={[styles.kind, kind === 'broken' && styles.kindOn]}
                  >
                    <Text style={styles.kindText}>{t(lang, 'feedback.broken')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { sfx.tap(); setKind('idea'); }}
                    testID="feedback-idea"
                    style={[styles.kind, kind === 'idea' && styles.kindOn]}
                  >
                    <Text style={styles.kindText}>{t(lang, 'feedback.idea')}</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t(lang, 'feedback.placeholder')}
                  placeholderTextColor={colors.inkSoft}
                  multiline
                  testID="feedback-text"
                  style={styles.input}
                />
                <View style={styles.row}>
                  <Pressable onPress={reset} testID="feedback-cancel" style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>{t(lang, 'feedback.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={send}
                    disabled={!kind && !text.trim()}
                    testID="feedback-send"
                    style={[styles.btn, (!kind && !text.trim()) && { opacity: 0.4 }]}
                  >
                    <Text style={styles.btnText}>{t(lang, 'feedback.send')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.blush,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.displayMed, fontSize: 14, color: colors.ink },
  chipCompact: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 999,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompactText: { fontSize: 16 },
  scrim: { flex: 1, backgroundColor: 'rgba(40,30,50,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 20, width: '100%', maxWidth: 420, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  kinds: { gap: 8 },
  kind: { borderRadius: 14, borderWidth: 3, borderColor: colors.blush, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'white' },
  kindOn: { borderColor: colors.gold, backgroundColor: '#FFF3D6' },
  kindText: { fontFamily: fonts.displayMed, fontSize: 15, color: colors.ink },
  input: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.blush,
    backgroundColor: 'white',
    minHeight: 70,
    padding: 10,
    fontFamily: fonts.bodyReg,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18 },
  btnText: { fontFamily: fonts.display, fontSize: 15, color: 'white' },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: { fontFamily: fonts.displayMed, fontSize: 15, color: colors.inkSoft },
});
