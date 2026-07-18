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
  {
    id: 'row',
    songId: 'row',
    vehicleY: 0.48,
    objects: {
      sky: [
        'obj_sky_seagull',
        'obj_sky_cloud_fluffy',
        'obj_sky_sun_rays',
        'obj_sky_pelican',
      ],
      mid: [
        'obj_mid_dolphin',
        'obj_mid_fish_orange',
        'obj_mid_jellyfish',
        'obj_mid_sea_turtle',
      ],
      ground: [
        'obj_ground_starfish',
        'obj_ground_shell_pink',
        'obj_ground_crab',
        'obj_ground_seahorse',
        'obj_ground_coral',
        'obj_ground_anchor',
      ],
    },
  },
  {
    id: 'jingle',
    songId: 'jingle',
    vehicleY: 0.42,
    objects: {
      sky: [
        'obj_sky_snowflake',
        'obj_sky_snowflake_big',
        'obj_sky_cardinal',
        'obj_sky_cloud_snowy',
      ],
      mid: [
        'obj_mid_pine_tree',
        'obj_mid_snowman',
        'obj_mid_deer',
        'obj_mid_cabin',
      ],
      ground: [
        'obj_ground_gift_red',
        'obj_ground_gift_blue',
        'obj_ground_holly',
        'obj_ground_candy_cane',
        'obj_ground_snow_bunny',
        'obj_ground_mitten',
      ],
    },
  },
];

export function sceneById(id: string): SceneDef | undefined {
  return SCENES.find((s) => s.id === id);
}
