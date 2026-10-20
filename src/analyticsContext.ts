import { Platform } from 'react-native';
import { routeParts } from './nav';
import { loadFilter } from './difficulty';
import pkg from '../package.json';
import { Lang } from './lang';

export function buildFeedbackContext(
  route: string,
  lang: Lang,
  viewport: { width: number; height: number },
  kind: string | null,
  text: string,
  uuid: string,
): Record<string, string | number> {
  const { screen: gameId, param: sceneId } = routeParts(route);

  const payload: Record<string, string | number> = {
    gameId,
    screen: route,
    lang,
    difficulty: loadFilter(),
    version: pkg.version || '1.0.0',
    platform: Platform.OS,
    viewport: `${Math.round(viewport.width)}x${Math.round(viewport.height)}`,
    kind: kind ?? 'idea',
    uuid,
    text: text.trim().slice(0, 500),
  };

  if (sceneId !== undefined) {
    payload.sceneId = sceneId;
  }

  return payload;
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
