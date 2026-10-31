import { Lang } from "../../lang";
import { Story, StoryNode } from "../../manifest";

function isStoryAvailable(story: Story, lang: Lang): boolean {
  if (lang === "en") return true;
  return Boolean(story.titleT?.[lang]?.trim());
}

/**
 * Filter stories to those localized for the requested language.
 * Stories lacking translations for non-English languages are omitted from the picker.
 */
export function filterStoriesByLang(stories: Story[], lang: Lang): Story[] {
  if (lang === "en") return stories;
  return stories.filter((story) => isStoryAvailable(story, lang));
}

const OOPSIE_REGEX = /\boops(ie|ies)?\b/i;

/**
 * Determine if a story node or text string represents an oopsie / failure ending.
 * Checks for explicit node.bad flag, or failure keywords with word boundaries
 * to prevent false positives on words like "swoops" or "loop-the-loops".
 */
export function isOopsieEnding(
  nodeOrText: StoryNode | string | null | undefined,
): boolean {
  if (!nodeOrText) return false;
  if (typeof nodeOrText === "string") {
    return OOPSIE_REGEX.test(nodeOrText);
  }
  if (nodeOrText.bad) return true;
  const isEnd = !nodeOrText.choices || nodeOrText.choices.length === 0;
  return Boolean(
    isEnd && nodeOrText.text && OOPSIE_REGEX.test(nodeOrText.text),
  );
}

const normalizedCache = new WeakMap<StoryNode, StoryNode>();

/**
 * Normalize a story node so that oopsie endings without the bad flag are marked bad: true.
 * Preserves reference identity across renders when node does not change.
 */
export function normalizeStoryNode(node: StoryNode): StoryNode;
export function normalizeStoryNode(node: StoryNode | null): StoryNode | null;
export function normalizeStoryNode(
  node: StoryNode | undefined,
): StoryNode | undefined;
export function normalizeStoryNode(
  node: StoryNode | null | undefined,
): StoryNode | null | undefined;
export function normalizeStoryNode(
  node: StoryNode | null | undefined,
): StoryNode | null | undefined {
  if (!node) return node;
  if (node.bad === true) return node;
  const cached = normalizedCache.get(node);
  if (cached) return cached;
  if (isOopsieEnding(node)) {
    const normalized = { ...node, bad: true };
    normalizedCache.set(node, normalized);
    return normalized;
  }
  normalizedCache.set(node, node);
  return node;
}
