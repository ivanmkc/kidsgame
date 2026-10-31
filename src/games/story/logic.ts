import { Lang } from '../../lang';
import { SCENE_AR, Story } from '../../manifest';

function isStoryAvailable(story: Story, lang: Lang): boolean {
  if (lang === 'en') return true;
  return Boolean(story.titleT?.[lang]?.trim());
}

/**
 * Filter stories to those localized for the requested language.
 * Stories lacking translations for non-English languages are omitted from the picker.
 */
export function filterStoriesByLang(stories: Story[], lang: Lang): Story[] {
  if (lang === 'en') return stories;
  return stories.filter((story) => isStoryAvailable(story, lang));
}

export const MIN_STORY_IMG_W = 260;
export const MAX_STORY_IMG_W = 900;

export interface StoryImageDimensions {
  imgW: number;
  imgH: number;
}

/**
 * Computes responsive story illustration dimensions.
 * Hotspot nodes have no button row below, so the picture gets more room.
 * Enforces a minimum width floor (260px) bounded by available viewport width,
 * so illustrations on compact landscape viewports don't collapse into negative
 * or near-zero dimensions while allowing the page to scroll.
 */
export function computeStoryImageDimensions(
  width: number,
  height: number,
  hasHots: boolean,
  ar: number = SCENE_AR,
): StoryImageDimensions {
  const availH = height - 84 - (hasHots ? 110 : 250);
  const fitW = availH * ar;
  const maxW = Math.min(Math.max(0, width - 24), MAX_STORY_IMG_W);
  const minW = Math.min(MIN_STORY_IMG_W, maxW);
  const imgW = Math.max(minW, Math.min(maxW, fitW));
  const imgH = imgW / ar;
  return { imgW, imgH };
}
