// Scene definitions for the music-box journey. Each scene pairs a song with
// a character, vehicle, parallax art, and pools of tap-spawned objects.

export interface SceneDef {
  id: string;
  songId: string;         // key into SONGS
  label: string;          // i18n suffix: `musicbox.scene.<id>`
  character: string;      // descriptive (for asset gen prompt)
  vehicle: string;
  /** Vertical anchor of the vehicle: 0 = top, 1 = bottom. */
  vehicleY: number;
  /** Emoji objects by spawn zone — used as placeholders until generated
   *  sprites land. Each entry is [emoji, displaySize]. */
  objects: {
    sky: string[];
    mid: string[];
    ground: string[];
  };
}

export const SCENES: SceneDef[] = [
  {
    id: 'twinkle',
    songId: 'twinkle',
    label: 'Twinkle',
    character: 'Luna (a cheerful bunny with a scarf)',
    vehicle: 'hot-air balloon',
    vehicleY: 0.32,
    objects: {
      sky: ['⭐', '🌙', '☁️', '✨', '🚀', '☄️'],
      mid: ['🌈', '🐦', '☁️', '🦅'],
      ground: ['🌸', '🌻', '🌳', '🍄', '🐐', '🌷'],
    },
  },
];

/** Look up a scene definition by id. */
export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
