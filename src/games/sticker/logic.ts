import { Lang } from '../../lang';
import { t, UIKey } from '../../i18n';
import { WORDS, wordFor } from '../../curriculum/content';
import { SCENE_AR } from '../../manifest';

export interface StickerLayout {
  isLandscape: boolean;
  stageW: number;
  stageH: number;
}

const MIN_STAGE_H = 180;
const MIN_STAGE_W = Math.round(MIN_STAGE_H * SCENE_AR); // 320

/**
 * Computes responsive dimensions and orientation for Sticker Party.
 * On mobile landscape viewports (height < 500), places the stage side-by-side
 * with the sticker tray so neither collapses. Enforces guaranteed minimum
 * playable stage dimensions.
 */
export function stickerLayout(width: number, height: number): StickerLayout {
  const ar = SCENE_AR;
  const isLandscape = width > height && height < 500;

  if (isLandscape) {
    const availH = Math.max(MIN_STAGE_H, height - 100);
    const maxStageW = Math.max(MIN_STAGE_W, width - 24 - 180);
    const stageWFromH = availH * ar;
    const stageW = Math.round(
      Math.max(Math.min(MIN_STAGE_W, width - 24), Math.min(width - 24, maxStageW, stageWFromH, 1100)),
    );
    const stageH = Math.round(stageW / ar);
    return { isLandscape, stageW, stageH };
  }

  const availH = Math.max(MIN_STAGE_H, height - 84 - 180 - 40);
  const maxW = Math.max(MIN_STAGE_W, width - 24);
  const stageW = Math.round(Math.max(Math.min(MIN_STAGE_W, width - 24), Math.min(maxW, availH * ar, 1100)));
  const stageH = Math.round(stageW / ar);
  return { isLandscape, stageW, stageH };
}

const DRESSUP_KEYS: Record<string, UIKey> = {
  dress_pink: 'sticker.item.dress_pink',
  dress_blue: 'sticker.item.dress_blue',
  tutu: 'sticker.item.tutu',
  crown: 'sticker.item.crown',
  tiara: 'sticker.item.tiara',
  wizard_hat: 'sticker.item.wizard_hat',
  sun_hat: 'sticker.item.sun_hat',
  wings_fairy: 'sticker.item.wings_fairy',
  wings_butterfly: 'sticker.item.wings_butterfly',
  cape: 'sticker.item.cape',
  sunglasses: 'sticker.item.sunglasses',
  bowtie: 'sticker.item.bowtie',
  necklace: 'sticker.item.necklace',
  boots: 'sticker.item.boots',
  wand: 'sticker.item.wand',
  umbrella: 'sticker.item.umbrella',
  dress_rainbow: 'sticker.item.dress_rainbow',
  dress_star: 'sticker.item.dress_star',
  dress_flower: 'sticker.item.dress_flower',
  dress_snow: 'sticker.item.dress_snow',
  kimono: 'sticker.item.kimono',
  raincoat: 'sticker.item.raincoat',
  party_hat: 'sticker.item.party_hat',
  police_cap: 'sticker.item.police_cap',
  fire_helmet: 'sticker.item.fire_helmet',
  chef_hat: 'sticker.item.chef_hat',
  cowboy_hat: 'sticker.item.cowboy_hat',
  space_helmet: 'sticker.item.space_helmet',
  flower_crown: 'sticker.item.flower_crown',
  scarf: 'sticker.item.scarf',
  ballet_slippers: 'sticker.item.ballet_slippers',
  rain_boots: 'sticker.item.rain_boots',
};

const CHARACTER_KEYS: Record<string, UIKey> = {
  princess_pink: 'sticker.character.princess_pink',
  princess_blue: 'sticker.character.princess_blue',
  prince: 'sticker.character.prince',
  knight: 'sticker.character.knight',
  fairy: 'sticker.character.fairy',
  mermaid: 'sticker.character.mermaid',
  wizard: 'sticker.character.wizard',
  ballerina: 'sticker.character.ballerina',
  superhero_kid: 'sticker.character.superhero_kid',
  dragon: 'sticker.character.dragon',
  mounted_knight: 'sticker.character.mounted_knight',
  princess_rider: 'sticker.character.princess_rider',
  queen: 'sticker.character.queen',
  police_officer: 'sticker.character.police_officer',
  firefighter: 'sticker.character.firefighter',
  doctor: 'sticker.character.doctor',
  astronaut: 'sticker.character.astronaut',
  chef: 'sticker.character.chef',
  pirate: 'sticker.character.pirate',
  cowgirl: 'sticker.character.cowgirl',
  robot: 'sticker.character.robot',
  vet: 'sticker.character.vet',
};

/**
 * Returns the localized child-friendly label for a sticker icon.
 * For icons in WORDS (animals, nature, food, things), looks up the translated word.
 * For dressup items and characters, looks up the localized item name in i18n dictionaries.
 * Fails loudly on unknown icons to prevent untranslated labels from shipping.
 */
export function stickerLabel(icon: string, lang: Lang = 'en'): string {
  const entry = WORDS.find((w) => w.icon === icon);
  if (entry) {
    return wordFor(entry, lang).text;
  }
  const key = DRESSUP_KEYS[icon] ?? CHARACTER_KEYS[icon];
  if (key) {
    return t(lang, key);
  }
  throw new Error(`Unknown sticker icon: ${icon}`);
}

/**
 * Spoken prompt for Sticker Party: when choosing a scene, speaks the picker
 * prompt; when entering or playing inside a scene, speaks the welcoming
 * decorating instruction so pre-readers know to start placing stickers.
 */
export function stickerPrompt(lang: Lang = 'en', inScene: boolean = false): string {
  return inScene ? t(lang, 'card.sticker.blurb') : t(lang, 'picker.sticker');
}
