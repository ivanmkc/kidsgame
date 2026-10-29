// Car Mode round packs — pure data, no side effects.
// Each round: prompt lines spoken aloud, a gap for the kid to answer, then
// reveal lines + optional sfx. EN-first; keys are stable for future i18n.
//
// Pack content is keyed by `id` so spoken lines can be enumerated
// deterministically by speechLines() for the voice-clip pipeline.

export type PackId =
  | 'boops'
  | 'rhyme'
  | 'simon'
  | 'silly'
  | 'whoami'
  | 'animal';

export interface Round {
  id: string;
  pack: PackId;
  prompt: string[];
  gapMs: number;
  reveal: string[];
  sfx?: 'good' | 'boing' | 'wrong';
  noteCount?: number;
  twoTapAnswer?: boolean;
  answer?: boolean;
  level?: 'easy' | 'medium' | 'hard';
}

// ── Count the Boops ─────────────────────────────────────────────────
function boopRounds(): Round[] {
  const out: Round[] = [];
  for (let n = 1; n <= 10; n++) {
    out.push({
      id: `boops-${n}`,
      pack: 'boops',
      prompt: [`How many boops?`],
      gapMs: 3000,
      reveal: [
        n === 1 ? '1! There was 1 boop!' : `${n}! There were ${n} boops!`,
      ],
      sfx: 'good',
      noteCount: n,
    });
  }
  return out;
}

// ── Finish the Rhyme ────────────────────────────────────────────────
// Difficulty rule: by how common the word and how obvious the rhyme is.
const RHYME_PAIRS: [string, string, 'easy' | 'medium' | 'hard'][] = [
  ['The cat wore a big red', 'HAT!', 'easy'],
  ['The frog sat on a', 'LOG!', 'easy'],
  ['A mouse lived in a', 'HOUSE!', 'easy'],
  ['The bear sat in a', 'CHAIR!', 'easy'],
  ['The bee climbed up a', 'TREE!', 'easy'],
  ['The goat wore a warm', 'COAT!', 'medium'],
  ['The bug gave me a', 'HUG!', 'easy'],
  ['The fox hid in a', 'BOX!', 'medium'],
  ['The snake ate some', 'CAKE!', 'hard'],
  ['The whale told a', 'TALE!', 'hard'],
  ['The hen found a', 'PEN!', 'medium'],
  ['The pig wore a', 'WIG!', 'easy'],
  ['The moose drank some', 'JUICE!', 'hard'],
  ['The ape ate a', 'GRAPE!', 'hard'],
  ['The crow said', 'HELLO!', 'hard'],
  ['The pup drank from a', 'CUP!', 'easy'],
  ['The bat put on a', 'HAT!', 'easy'],
  ['The fly ate some', 'PIE!', 'medium'],
  ['The dog jumped on a', 'LOG!', 'easy'],
  ['The eel had a big', 'MEAL!', 'hard'],
];

function rhymeRounds(): Round[] {
  return RHYME_PAIRS.map(([setup, punch, level], i) => ({
    id: `rhyme-${i}`,
    pack: 'rhyme' as PackId,
    prompt: [`${setup}...`],
    gapMs: 3500,
    reveal: [punch],
    sfx: 'good' as const,
    level,
  }));
}

// ── Simon Says, Seat Edition ────────────────────────────────────────
// Difficulty rule: untagged; plays the full mix for all difficulties.
const SIMON_ACTIONS = [
  'Wiggle your toes!',
  'Blink three times!',
  'Pat your head!',
  'Touch your nose!',
  'Roar like a lion!',
  'Clap your hands!',
  'Wave hello!',
  'Squeeze your eyes shut!',
  'Puff up your cheeks!',
  'Tap your knees!',
  'Stick out your tongue!',
  'Make a silly face!',
  'Rub your tummy!',
  'Snap your fingers!',
  'Nod your head!',
  'Shake your head no!',
  'Give a thumbs up!',
  'Hum a little song!',
];

function simonRounds(): Round[] {
  const out: Round[] = [];
  SIMON_ACTIONS.forEach((action, i) => {
    out.push({
      id: `simon-${i}`,
      pack: 'simon',
      prompt: [`Simon says... ${action}`],
      gapMs: 3500,
      reveal: ['Great job!'],
      sfx: 'good',
    });
  });
  // Trick rounds (no "Simon says")
  const TRICK_ACTIONS = [
    'Touch your nose!',
    'Clap your hands!',
    'Wiggle your toes!',
    'Pat your head!',
  ];
  TRICK_ACTIONS.forEach((action, i) => {
    out.push({
      id: `simon-trick-${i}`,
      pack: 'simon',
      prompt: [action],
      gapMs: 2500,
      reveal: ['Oops! I did not say Simon says!'],
      sfx: 'boing',
    });
  });
  return out;
}

// ── Silly or True? ──────────────────────────────────────────────────
// Difficulty rule: by how familiar the fact is.
interface SillyRound {
  statement: string;
  isSilly: boolean;
  level: 'easy' | 'medium' | 'hard';
}

const SILLY_STATEMENTS: SillyRound[] = [
  { statement: 'Cows can fly!', isSilly: true, level: 'easy' },
  { statement: 'Fish live in water!', isSilly: false, level: 'easy' },
  { statement: 'Dogs can bark!', isSilly: false, level: 'easy' },
  { statement: 'Cats wear shoes!', isSilly: true, level: 'easy' },
  { statement: 'The sun is hot!', isSilly: false, level: 'easy' },
  { statement: 'Bananas are blue!', isSilly: true, level: 'easy' },
  { statement: 'Trees can dance!', isSilly: true, level: 'medium' },
  { statement: 'Birds have wings!', isSilly: false, level: 'easy' },
  { statement: 'The moon is made of cheese!', isSilly: true, level: 'hard' },
  { statement: 'Elephants are big!', isSilly: false, level: 'medium' },
  { statement: 'Frogs drive cars!', isSilly: true, level: 'easy' },
  { statement: 'Rain comes from clouds!', isSilly: false, level: 'medium' },
  { statement: 'Monkeys wear hats to school!', isSilly: true, level: 'medium' },
  { statement: 'Snow is cold!', isSilly: false, level: 'medium' },
  { statement: 'Spiders have eight legs!', isSilly: false, level: 'hard' },
  { statement: 'Penguins play the piano!', isSilly: true, level: 'hard' },
  { statement: 'Ice cream is frozen!', isSilly: false, level: 'medium' },
  { statement: 'Giraffes have long necks!', isSilly: false, level: 'hard' },
  { statement: 'Cars eat sandwiches!', isSilly: true, level: 'medium' },
  { statement: 'Babies can ride bicycles!', isSilly: true, level: 'hard' },
  { statement: 'Rabbits hop!', isSilly: false, level: 'hard' },
  { statement: 'Shoes grow on trees!', isSilly: true, level: 'hard' },
  { statement: 'Water is wet!', isSilly: false, level: 'hard' },
  { statement: 'Rocks can sing!', isSilly: true, level: 'hard' },
];

function sillyRounds(): Round[] {
  return SILLY_STATEMENTS.map((s, i) => ({
    id: `silly-${i}`,
    pack: 'silly' as PackId,
    prompt: [
      s.statement,
      'Tap once for TRUE! Tap twice for SILLY!',
    ],
    gapMs: 4000,
    reveal: s.isSilly
      ? ['SILLY!']
      : ['TRUE!'],
    sfx: s.isSilly ? 'boing' as const : 'good' as const,
    twoTapAnswer: true,
    answer: !s.isSilly,
    level: s.level,
  }));
}

// ── Who Am I? ───────────────────────────────────────────────────────
// Difficulty rule: by number and specificity of clues, with character names not in Easy.
interface RiddleSpec {
  clues: string[];
  answer: string;
  level: 'easy' | 'medium' | 'hard';
}

const RIDDLES: RiddleSpec[] = [
  { clues: ['I am a sparkly unicorn.', 'I love to fly through rainbows.'], answer: 'LUNA!', level: 'hard' },
  { clues: ['I am a little puppy.', 'I wag my tail all day long.'], answer: 'PIP!', level: 'hard' },
  { clues: ['I am a little black kitten.', 'I carry a glowing lantern.'], answer: 'MILO!', level: 'hard' },
  { clues: ['I am a fluffy mint monster.', 'I give the biggest hugs!'], answer: 'MO!', level: 'hard' },
  { clues: ['I am a brave fox knight.', 'I wear shiny silver armor.'], answer: 'NOVA!', level: 'hard' },
  { clues: ['I am a big friendly dinosaur.', 'I love to stomp and roar!'], answer: 'REX!', level: 'medium' },
  { clues: ['I am a wise little owl.', 'I love to fly at night with my pointy hat.'], answer: 'WILLOW!', level: 'medium' },
  { clues: ['I am a beautiful sea dragon.', 'I swim in the deep blue ocean.'], answer: 'PEARL!', level: 'hard' },
  { clues: ['I am very tall with a long neck.', 'I have brown spots all over.'], answer: 'A giraffe!', level: 'easy' },
  { clues: ['I am black and white.', 'I waddle on the ice and love to swim.'], answer: 'A penguin!', level: 'easy' },
  { clues: ['I have a big mane.', 'I am the king of the jungle.'], answer: 'A lion!', level: 'easy' },
  { clues: ['I have eight legs.', 'I spin a sticky web.'], answer: 'A spider!', level: 'easy' },
  { clues: ['I am very slow.', 'I carry my house on my back.', 'I leave a shiny silver trail wherever I go.'], answer: 'A snail!', level: 'medium' },
  { clues: ['I have stripes.', 'I look like a horse in pajamas!'], answer: 'A zebra!', level: 'easy' },
  { clues: ['I am pink.', 'I stand on one leg in the water.'], answer: 'A flamingo!', level: 'medium' },
  { clues: ['I am gray and wrinkly.', 'I have a very long nose called a trunk.'], answer: 'An elephant!', level: 'easy' },
];

function whoamiRounds(): Round[] {
  return RIDDLES.map((r, i) => ({
    id: `whoami-${i}`,
    pack: 'whoami' as PackId,
    prompt: ['Who am I?', ...r.clues],
    gapMs: 4000,
    reveal: [r.answer],
    sfx: 'good' as const,
    level: r.level,
  }));
}

// ── Animal Sound Safari (TTS edition) ───────────────────────────────
// Difficulty rule: by how familiar the animal is.
interface AnimalSound {
  onomatopoeia: string;
  answer: string;
  level: 'easy' | 'medium' | 'hard';
}

const ANIMAL_SOUNDS: AnimalSound[] = [
  { onomatopoeia: 'Mooooo!', answer: 'A cow!', level: 'easy' },
  { onomatopoeia: 'Woof woof!', answer: 'A dog!', level: 'easy' },
  { onomatopoeia: 'Meow meow!', answer: 'A cat!', level: 'easy' },
  { onomatopoeia: 'Cock-a-doodle-doo!', answer: 'A rooster!', level: 'easy' },
  { onomatopoeia: 'Baaa baaa!', answer: 'A sheep!', level: 'easy' },
  { onomatopoeia: 'Oink oink!', answer: 'A pig!', level: 'easy' },
  { onomatopoeia: 'Quack quack!', answer: 'A duck!', level: 'easy' },
  { onomatopoeia: 'Neigh!', answer: 'A horse!', level: 'easy' },
  { onomatopoeia: 'Hoo hoo hoo!', answer: 'An owl!', level: 'medium' },
  { onomatopoeia: 'Ribbit ribbit!', answer: 'A frog!', level: 'medium' },
  { onomatopoeia: 'Bzzzzzzz!', answer: 'A bee!', level: 'medium' },
  { onomatopoeia: 'Hisssssss!', answer: 'A snake!', level: 'hard' },
  { onomatopoeia: 'Roar!', answer: 'A lion!', level: 'medium' },
  { onomatopoeia: 'Tweet tweet!', answer: 'A bird!', level: 'easy' },
  { onomatopoeia: 'Squeak squeak!', answer: 'A mouse!', level: 'medium' },
  { onomatopoeia: 'Gobble gobble!', answer: 'A turkey!', level: 'hard' },
  { onomatopoeia: 'Caw caw!', answer: 'A crow!', level: 'hard' },
  { onomatopoeia: 'Eee-aw! Eee-aw!', answer: 'A donkey!', level: 'hard' },
  { onomatopoeia: 'Chirp chirp!', answer: 'A cricket!', level: 'hard' },
  { onomatopoeia: 'Snap snap!', answer: 'An alligator!', level: 'hard' },
];

function animalRounds(): Round[] {
  return ANIMAL_SOUNDS.map((a, i) => ({
    id: `animal-${i}`,
    pack: 'animal' as PackId,
    prompt: ['What animal makes this sound?', a.onomatopoeia],
    gapMs: 3500,
    reveal: [`It was... ${a.answer} Did you get it?`],
    sfx: 'good' as const,
    level: a.level,
  }));
}

// ── Public API ──────────────────────────────────────────────────────

export const ALL_PACKS: Record<PackId, { name: string; rounds: () => Round[] }> = {
  boops: { name: 'Count the Boops', rounds: boopRounds },
  rhyme: { name: 'Finish the Rhyme', rounds: rhymeRounds },
  simon: { name: 'Simon Says', rounds: simonRounds },
  silly: { name: 'Silly or True?', rounds: sillyRounds },
  whoami: { name: 'Who Am I?', rounds: whoamiRounds },
  animal: { name: 'Animal Sound Safari', rounds: animalRounds },
};

export const PACK_ORDER: PackId[] = ['boops', 'rhyme', 'simon', 'silly', 'whoami', 'animal'];
