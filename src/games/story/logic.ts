import { Lang } from '../../lang';
import { Story } from '../../manifest';

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
