// Scene definitions for the music-box journey. Each scene pairs a song with
// parallax art and pools of tap-spawned object sprites.
// Sprite keys map into MUSICBOX_IMAGES via `${sceneId}/${key}`.

export interface SceneDef {
  id: string;
  songId: string;
  /** Vertical anchor of the vehicle: 0 = top, 1 = bottom. */
  vehicleY: number;
  /** Sprite keys for tap-spawned objects, grouped by vertical zone. */
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
    vehicleY: 0.28,
    objects: {
      sky: [
        'obj_sky_star',
        'obj_sky_comet',
        'obj_sky_moon_crescent',
        'obj_sky_cloud_wispy',
        'obj_sky_rocket',
        'obj_sky_sparkle',
      ],
      mid: [
        'obj_mid_rainbow',
        'obj_mid_bird',
        'obj_mid_cloud_puffy',
        'obj_mid_owl',
      ],
      ground: [
        'obj_ground_flower_pink',
        'obj_ground_flower_yellow',
        'obj_ground_tree_round',
        'obj_ground_mushroom',
        'obj_ground_mountain_goat',
        'obj_ground_tulip',
      ],
    },
  },
];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
