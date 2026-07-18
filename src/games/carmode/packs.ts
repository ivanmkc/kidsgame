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
      reveal: [`${n}! There were ${n} boops!`],
      sfx: 'good',
      noteCount: n,
    });
  }
  return out;
}

// ── Finish the Rhyme ────────────────────────────────────────────────
const RHYME_PAIRS: [string, string][] = [
  ['The cat wore a big red', 'HAT!'],
  ['The frog sat on a', 'LOG!'],
  ['A mouse lived in a', 'HOUSE!'],
  ['The bear sat in a', 'CHAIR!'],
  ['The bee climbed up a', 'TREE!'],
  ['The goat wore a warm', 'COAT!'],
  ['The bug gave me a', 'HUG!'],
  ['The fox hid in a', 'BOX!'],
  ['The snake ate some', 'CAKE!'],
  ['The whale told a', 'TALE!'],
  ['The hen found a', 'PEN!'],
  ['The pig wore a', 'WIG!'],
  ['The moose drank some', 'JUICE!'],
  ['The ape ate a', 'GRAPE!'],
  ['The crow said', 'HELLO!'],
  ['The pup drank from a', 'CUP!'],
  ['The bat put on a', 'HAT!'],
  ['The fly ate some', 'PIE!'],
  ['The dog jumped on a', 'LOG!'],
  ['The eel had a big', 'MEAL!'],
];

function rhymeRounds(): Round[] {
  return RHYME_PAIRS.map(([setup, punch], i) => ({
    id: `rhyme-${i}`,
    pack: 'rhyme' as PackId,
    prompt: [`${setup}...`],
    gapMs: 3500,
    reveal: [punch],
    sfx: 'good' as const,
  }));
}

// ── Simon Says, Seat Edition ────────────────────────────────────────
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
interface SillyRound {
  statement: string;
  isSilly: boolean;
}

const SILLY_STATEMENTS: SillyRound[] = [
  { statement: 'Cows can fly!', isSilly: true },
  { statement: 'Fish live in water!', isSilly: false },
  { statement: 'Dogs can bark!', isSilly: false },
  { statement: 'Cats wear shoes!', isSilly: true },
  { statement: 'The sun is hot!', isSilly: false },
  { statement: 'Bananas are blue!', isSilly: true },
  { statement: 'Trees can dance!', isSilly: true },
  { statement: 'Birds have wings!', isSilly: false },
  { statement: 'The moon is made of cheese!', isSilly: true },
  { statement: 'Elephants are big!', isSilly: false },
  { statement: 'Frogs drive cars!', isSilly: true },
  { statement: 'Rain comes from clouds!', isSilly: false },
  { statement: 'Monkeys wear hats to school!', isSilly: true },
  { statement: 'Snow is cold!', isSilly: false },
  { statement: 'Spiders have eight legs!', isSilly: false },
  { statement: 'Penguins play the piano!', isSilly: true },
  { statement: 'Ice cream is frozen!', isSilly: false },
  { statement: 'Giraffes have long necks!', isSilly: false },
  { statement: 'Cars eat sandwiches!', isSilly: true },
  { statement: 'Babies can ride bicycles!', isSilly: true },
  { statement: 'Rabbits hop!', isSilly: false },
  { statement: 'Shoes grow on trees!', isSilly: true },
  { statement: 'Water is wet!', isSilly: false },
  { statement: 'Rocks can sing!', isSilly: true },
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
  }));
}

// ── Who Am I? ───────────────────────────────────────────────────────
interface RiddleSpec {
  clues: string[];
  answer: string;
}

const RIDDLES: RiddleSpec[] = [
  { clues: ['I am a sparkly unicorn.', 'I love to fly through rainbows.'], answer: 'LUNA!' },
  { clues: ['I am a little puppy.', 'I wag my tail all day long.'], answer: 'PIP!' },
  { clues: ['I am a little black kitten.', 'I carry a glowing lantern.'], answer: 'MILO!' },
  { clues: ['I am a fluffy mint monster.', 'I give the biggest hugs!'], answer: 'MO!' },
  { clues: ['I am a brave fox knight.', 'I wear shiny silver armor.'], answer: 'NOVA!' },
  { clues: ['I am a big friendly dinosaur.', 'I love to stomp and roar!'], answer: 'REX!' },
  { clues: ['I am a wise little owl.', 'I love to fly at night with my pointy hat.'], answer: 'WILLOW!' },
  { clues: ['I am a beautiful sea dragon.', 'I swim in the deep blue ocean.'], answer: 'PEARL!' },
  { clues: ['I am very tall with a long neck.', 'I have brown spots all over.'], answer: 'A giraffe!' },
  { clues: ['I am black and white.', 'I waddle on the ice and love to swim.'], answer: 'A penguin!' },
  { clues: ['I have a big mane.', 'I am the king of the jungle.'], answer: 'A lion!' },
  { clues: ['I have eight legs.', 'I spin a sticky web.'], answer: 'A spider!' },
  { clues: ['I am very slow.', 'I carry my house on my back.'], answer: 'A snail!' },
  { clues: ['I have stripes.', 'I look like a horse in pajamas!'], answer: 'A zebra!' },
  { clues: ['I am pink.', 'I stand on one leg in the water.'], answer: 'A flamingo!' },
  { clues: ['I am gray and wrinkly.', 'I have a very long nose called a trunk.'], answer: 'An elephant!' },
];

function whoamiRounds(): Round[] {
  return RIDDLES.map((r, i) => ({
    id: `whoami-${i}`,
    pack: 'whoami' as PackId,
    prompt: ['Who am I?', ...r.clues],
    gapMs: 4000,
    reveal: [r.answer],
    sfx: 'good' as const,
  }));
}

// ── Animal Sound Safari (TTS edition) ───────────────────────────────
interface AnimalSound {
  onomatopoeia: string;
  answer: string;
}

const ANIMAL_SOUNDS: AnimalSound[] = [
  { onomatopoeia: 'Mooooo!', answer: 'A cow!' },
  { onomatopoeia: 'Woof woof!', answer: 'A dog!' },
  { onomatopoeia: 'Meow meow!', answer: 'A cat!' },
  { onomatopoeia: 'Cock-a-doodle-doo!', answer: 'A rooster!' },
  { onomatopoeia: 'Baaa baaa!', answer: 'A sheep!' },
  { onomatopoeia: 'Oink oink!', answer: 'A pig!' },
  { onomatopoeia: 'Quack quack!', answer: 'A duck!' },
  { onomatopoeia: 'Neigh!', answer: 'A horse!' },
  { onomatopoeia: 'Hoo hoo hoo!', answer: 'An owl!' },
  { onomatopoeia: 'Ribbit ribbit!', answer: 'A frog!' },
  { onomatopoeia: 'Bzzzzzzz!', answer: 'A bee!' },
  { onomatopoeia: 'Hisssssss!', answer: 'A snake!' },
  { onomatopoeia: 'Roar!', answer: 'A lion!' },
  { onomatopoeia: 'Tweet tweet!', answer: 'A bird!' },
  { onomatopoeia: 'Squeak squeak!', answer: 'A mouse!' },
  { onomatopoeia: 'Gobble gobble!', answer: 'A turkey!' },
  { onomatopoeia: 'Caw caw!', answer: 'A crow!' },
  { onomatopoeia: 'Eee-aw! Eee-aw!', answer: 'A donkey!' },
  { onomatopoeia: 'Chirp chirp!', answer: 'A cricket!' },
  { onomatopoeia: 'Snap snap!', answer: 'An alligator!' },
];

function animalRounds(): Round[] {
  return ANIMAL_SOUNDS.map((a, i) => ({
    id: `animal-${i}`,
    pack: 'animal' as PackId,
    prompt: ['What animal makes this sound?', a.onomatopoeia],
    gapMs: 3500,
    reveal: [`It was... ${a.answer} Did you get it?`],
    sfx: 'good' as const,
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
