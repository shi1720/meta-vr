/**
 * The Signsprout ASL sign library (v1): ~50 high-value signs for families,
 * fingerspelling A–Z and numbers 1–10.
 *
 * Every sign is described by its phonological parameters (handshape,
 * location, orientation, movement) and was cross-checked against at least
 * two references (Handspeak by Jolanta Lapiak, a native Deaf signer, and
 * Lifeprint / ASL University by Dr. Bill Vicars). Descriptions are our own.
 * Directions are for a right-handed signer; left-handed learners get the
 * mirror image automatically.
 *
 * Coordinates: body-local meters relative to the eyes. +x = signer's right
 * (ipsi), +y = up, -z = forward (out).
 */

import type { HandKey, SignDef, Segment } from './sign.js';
import { oneHanded, symmetric, twoHanded } from './sign.js';
import notes from './data/sign-notes.json' with { type: 'json' };

type Notes = Record<string, { sources: string[]; mistakes: string[]; nonManual: string | null; variants: string[] }>;
const NOTES = notes as Notes;

/** Attach reference links, common mistakes and variants from the research notes. */
function withNotes(def: SignDef, gloss = def.gloss): SignDef {
  const n = NOTES[gloss];
  if (!n) return def;
  return {
    ...def,
    sources: def.sources ?? n.sources,
    mistakes: def.mistakes ?? n.mistakes,
    nonManual: def.nonManual ?? n.nonManual ?? undefined,
    variants: def.variants ?? (n.variants.length ? n.variants.join(' ') : undefined),
  };
}

const K = (k: HandKey): HandKey => k;

// Common spots in front of the body
const SHOULDER_FRONT: [number, number, number] = [0.15, -0.21, -0.3];

// ---------------------------------------------------------------------------
// Unit 1. First words
// ---------------------------------------------------------------------------

const HELLO = oneHanded(
  {
    id: 'hello',
    gloss: 'HELLO',
    english: 'hello',
    category: 'greetings',
    difficulty: 1,
    howTo: 'Touch your flat hand to the side of your forehead like a small salute, then move it out and away.',
    hint: 'A friendly salute.',
  },
  K({ shape: 'B', at: 'temple', contact: 'fingertips', palm: 'out', fingers: 'up-contra' }),
  { to: { at: 'temple', offset: [0.15, -0.02, -0.11], fingers: 'up' }, path: 'arc', lift: [0.02, 0.03, -0.02], dur: 0.6 },
);

const THANK_YOU = oneHanded(
  {
    id: 'thank-you',
    gloss: 'THANK-YOU',
    english: 'thank you',
    category: 'courtesy',
    difficulty: 1,
    howTo: 'Touch the fingertips of your flat hand to your chin, then move your hand forward and down towards the person. and smile.',
    hint: 'Your thanks leaves your lips and goes to them.',
  },
  K({ shape: 'open-B', at: 'chin', contact: 'fingertips', palm: 'in', fingers: 'up' }),
  { to: { at: 'chin', offset: [0.03, -0.12, -0.22], palm: 'up-in', fingers: 'out-up' }, path: 'arc', lift: [0, 0.02, -0.03], dur: 0.65 },
);

const I_LOVE_YOU = oneHanded(
  {
    id: 'i-love-you',
    gloss: 'I-LOVE-YOU',
    english: 'I love you',
    category: 'family',
    difficulty: 1,
    howTo: 'Raise your thumb, index finger and pinky together, palm facing the person you love.',
    hint: 'It combines the letters I, L and Y.',
  },
  K({ shape: 'ILY', at: SHOULDER_FRONT, offset: [0, 0.03, 0], palm: 'out', fingers: 'up' }),
  { path: 'hold', dur: 0.9 },
);

// ---------------------------------------------------------------------------
// Unit 2. Mealtime
// ---------------------------------------------------------------------------

const MORE = symmetric(
  {
    id: 'more',
    gloss: 'MORE',
    english: 'more',
    category: 'needs',
    difficulty: 2,
    howTo: 'Bunch the fingertips of each hand onto the thumb and tap the two bunches together, twice.',
    hint: 'Adding more to the pile.',
  },
  K({ shape: 'flat-O', at: [0.012, -0.3, -0.3], contact: 'fingertips', palm: 'contra-down', fingers: 'contra' }),
  { path: 'tap', direction: 'ipsi', amplitude: 0.05, repeat: 2 },
);

const EAT = oneHanded(
  {
    id: 'eat',
    gloss: 'EAT',
    english: 'eat / food',
    category: 'needs',
    difficulty: 1,
    howTo: 'Bunch your fingertips onto your thumb and tap them to your lips, twice. like putting food in your mouth.',
  },
  K({ shape: 'flat-O', at: 'mouth', contact: 'fingertips', palm: 'in-down', fingers: 'in' }),
  { path: 'tap', direction: 'out', amplitude: 0.04, repeat: 2 },
);

const DRINK = oneHanded(
  {
    id: 'drink',
    gloss: 'DRINK',
    english: 'drink',
    category: 'needs',
    difficulty: 2,
    howTo: 'Hold a C-hand like a cup by your chin, then tip it towards your mouth as if taking a sip.',
  },
  K({ shape: 'C', at: 'chin', offset: [0.01, -0.01, -0.03], contact: 'thumb-tip', palm: 'contra', fingers: 'out' }),
  { to: { at: 'mouth', offset: [0.01, 0.0, -0.02], fingers: 'up-out' }, path: 'line', dur: 0.55 },
);

const MILK = oneHanded(
  {
    id: 'milk',
    gloss: 'MILK',
    english: 'milk',
    category: 'needs',
    difficulty: 1,
    howTo: 'Hold up a loose C-hand and squeeze it closed into a fist, twice. like milking a cow.',
    hint: 'One of the first signs many babies learn.',
  },
  K({ shape: 'C', at: SHOULDER_FRONT, offset: [-0.02, -0.04, 0], palm: 'contra', fingers: 'up' }),
  { to: { shape: 'S' }, path: 'squeeze', repeat: 2 },
);

const WATER = oneHanded(
  {
    id: 'water',
    gloss: 'WATER',
    english: 'water',
    category: 'needs',
    difficulty: 1,
    howTo: 'Make a W (three middle fingers up) and tap your index finger on your chin twice.',
    hint: 'W for water, at the mouth.',
  },
  K({ shape: 'W', at: 'chin', contact: 'index-tip', palm: 'contra', fingers: 'up' }),
  { path: 'tap', direction: 'out', amplitude: 0.03, repeat: 2 },
);

const FINISH = symmetric(
  {
    id: 'finish',
    gloss: 'FINISH',
    english: 'all done / finished',
    category: 'needs',
    difficulty: 2,
    howTo: 'Hold up both open hands, palms towards you, then quickly twist them so your palms face out. "all done!"',
    hint: 'Shaking the last crumbs off your hands.',
  },
  K({ shape: '5', at: [0.16, -0.3, -0.28], palm: 'in', fingers: 'up' }),
  { to: { palm: 'contra', offset: [0.02, 0, -0.01] }, path: 'line', dur: 0.2 },
  { to: { palm: 'out', fingers: 'up-ipsi', offset: [0.04, 0, -0.02] }, path: 'line', dur: 0.22 },
);

const HUNGRY = oneHanded(
  {
    id: 'hungry',
    gloss: 'HUNGRY',
    english: 'hungry',
    category: 'feelings',
    difficulty: 2,
    howTo: 'Put a C-hand on your upper chest and move it straight down once, like food going down to your tummy.',
    hint: 'Do it once. the movement is a single slide.',
  },
  K({ shape: 'C', at: 'chest', offset: [0, 0.07, 0.01], contact: 'fingertips', palm: 'in', fingers: 'up' }),
  { to: { at: 'stomach', offset: [0, 0.03, 0.0] }, path: 'line', dur: 0.6 },
);

// ---------------------------------------------------------------------------
// Unit 3. Family
// ---------------------------------------------------------------------------

const MOTHER = oneHanded(
  {
    id: 'mother',
    gloss: 'MOTHER',
    english: 'mom / mother',
    category: 'family',
    difficulty: 1,
    howTo: 'Spread your hand open and tap your thumb on your chin, twice.',
    hint: 'Many signs for women in the family (MOTHER, GRANDMOTHER) are made near the chin.',
  },
  K({ shape: '5', at: 'chin', contact: 'thumb-tip', palm: 'contra', fingers: 'up' }),
  { path: 'tap', direction: 'out', amplitude: 0.03, repeat: 2 },
);

const FATHER = oneHanded(
  {
    id: 'father',
    gloss: 'FATHER',
    english: 'dad / father',
    category: 'family',
    difficulty: 1,
    howTo: 'Spread your hand open and tap your thumb on your forehead, twice.',
    hint: 'Male signs are made near the forehead.',
  },
  K({ shape: '5', at: 'forehead', offset: [0.012, 0, 0], contact: 'thumb-tip', palm: 'contra', fingers: 'up' }),
  { path: 'tap', direction: 'out', amplitude: 0.03, repeat: 2 },
);

const BABY = twoHanded(
  {
    id: 'baby',
    gloss: 'BABY',
    english: 'baby',
    category: 'family',
    difficulty: 2,
    howTo: 'Cradle your arms, one resting on the other with palms up, and rock them gently side to side.',
    hint: 'Rocking a baby.',
  },
  {
    start: K({ shape: 'open-B', at: [-0.1, -0.44, -0.3], palm: 'up', fingers: 'contra' }),
    moves: [{ path: 'tap', direction: 'ipsi', amplitude: 0.07, repeat: 2, dur: 1.1 }],
  },
  {
    start: K({ shape: 'open-B', at: [0.12, -0.47, -0.27], palm: 'up', fingers: 'ipsi' }),
    moves: [{ path: 'tap', direction: 'ipsi', amplitude: 0.07, repeat: 2, dur: 1.1 }],
  },
);

const LOVE = twoHanded(
  {
    id: 'love',
    gloss: 'LOVE',
    english: 'love',
    category: 'family',
    difficulty: 2,
    howTo: 'Cross your fists over your heart, like a hug.',
  },
  {
    start: K({ shape: 'S', at: 'heart', offset: [-0.01, 0.02, -0.02], palm: 'in', fingers: 'up-contra' }),
    moves: [{ path: 'hold', dur: 0.9 }],
  },
  {
    start: K({ shape: 'S', at: 'chest-ipsi', offset: [0.0, 0.0, 0.0], palm: 'in', fingers: 'up-ipsi' }),
    moves: [{ path: 'hold', dur: 0.9 }],
  },
);

const FAMILY = symmetric(
  {
    id: 'family',
    gloss: 'FAMILY',
    english: 'family',
    category: 'family',
    difficulty: 3,
    howTo: 'Touch your F-hands together in front of you, then draw a circle outwards and around until your little fingers meet. everyone around the table.',
  },
  K({ shape: 'F', at: [0.025, -0.3, -0.36], contact: 'thumb-side', palm: 'out', fingers: 'up' }),
  { to: { at: [0.15, -0.3, -0.28], palm: 'ipsi' }, path: 'arc', lift: [0.02, 0, -0.03], dur: 0.45 },
  { to: { at: [0.03, -0.3, -0.2], palm: 'in' }, path: 'arc', lift: [0.02, 0, 0.03], dur: 0.45 },
);

const ME = oneHanded(
  {
    id: 'me',
    gloss: 'ME',
    english: 'me / I',
    category: 'family',
    difficulty: 1,
    howTo: 'Point your index finger at the middle of your chest.',
  },
  K({ shape: '1', at: 'chest', offset: [0, 0, -0.07], contact: 'index-tip', palm: 'contra', fingers: 'in' }),
  { to: { offset: [0, 0, -0.02] }, path: 'line', dur: 0.3 },
);

const YOU = oneHanded(
  {
    id: 'you',
    gloss: 'YOU',
    english: 'you',
    category: 'family',
    difficulty: 1,
    howTo: 'Point your index finger at the person you are talking to.',
  },
  K({ shape: '1', at: 'neutral', offset: [0, 0.03, 0.08], contact: 'index-tip', palm: 'down-contra', fingers: 'out' }),
  { to: { offset: [0, 0.03, -0.04] }, path: 'line', dur: 0.35 },
);

const MY = oneHanded(
  {
    id: 'my',
    gloss: 'MY',
    english: 'my / mine',
    category: 'family',
    difficulty: 1,
    howTo: 'Place your flat hand on your chest.',
  },
  K({ shape: 'open-B', at: 'chest', contact: 'palm', palm: 'in', fingers: 'contra' }),
  { path: 'tap', direction: 'out', amplitude: 0.045, repeat: 1, dur: 0.5 },
);

const YOUR = oneHanded(
  {
    id: 'your',
    gloss: 'YOUR',
    english: 'your / yours',
    category: 'family',
    difficulty: 1,
    howTo: 'Show your flat palm to the person and push it slightly towards them.',
  },
  K({ shape: 'open-B', at: SHOULDER_FRONT, offset: [0, -0.03, 0.06], palm: 'out', fingers: 'up' }),
  { to: { offset: [0, -0.03, -0.06] }, path: 'line', dur: 0.4 },
);

const NAME = twoHanded(
  {
    id: 'name',
    gloss: 'NAME',
    english: 'name',
    category: 'family',
    difficulty: 3,
    howTo: 'Make an H with both hands and tap the fingers of your dominant hand across the other hand’s fingers, twice.',
    hint: 'The fingers make an X, like signing your mark.',
  },
  {
    start: K({ shape: 'H', at: [0.0, -0.285, -0.3], contact: 'fingerpads', palm: 'in-contra', fingers: 'contra-out' }),
    moves: [{ path: 'tap', direction: 'up', amplitude: 0.03, repeat: 2 }],
  },
  {
    start: K({ shape: 'H', at: [-0.02, -0.3, -0.3], contact: 'fingerpads', palm: 'in-ipsi', fingers: 'ipsi-out' }),
    moves: [{ path: 'hold', dur: 0.8 }],
  },
);

// ---------------------------------------------------------------------------
// Unit 4. Bath & bedtime
// ---------------------------------------------------------------------------

const BATH = symmetric(
  {
    id: 'bath',
    gloss: 'BATH',
    english: 'bath',
    category: 'actions',
    difficulty: 2,
    howTo: 'Rub two fists up and down on your chest, like scrubbing in the bath.',
  },
  K({ shape: 'A', at: 'chest', offset: [0.07, 0.02, 0.0], contact: 'palm', palm: 'in', fingers: 'contra' }),
  { path: 'tap', direction: 'up', amplitude: 0.06, repeat: 2 },
);

const SLEEP = oneHanded(
  {
    id: 'sleep',
    gloss: 'SLEEP',
    english: 'sleep',
    category: 'actions',
    difficulty: 2,
    howTo: 'Hold your open hand in front of your face and draw it down to your chin while closing your fingers together. and close your eyes.',
    hint: 'Your eyes closing.',
  },
  K({ shape: '5', at: 'eyes', offset: [-0.03, 0.0, -0.07], contact: 'palm', palm: 'in', fingers: 'up' }),
  { to: { shape: 'flat-O', at: 'chin', offset: [-0.03, 0.0, -0.06] }, path: 'line', dur: 0.8 },
);

const TIRED = symmetric(
  {
    id: 'tired',
    gloss: 'TIRED',
    english: 'tired',
    category: 'feelings',
    difficulty: 2,
    howTo: 'Put the fingertips of both bent hands on your upper chest, then let your hands droop down while the fingertips stay put.',
  },
  K({ shape: 'bent-B', at: 'chest', offset: [0.09, 0.05, 0.0], contact: 'fingertips', palm: 'in', fingers: 'up' }),
  { to: { palm: 'up-in', fingers: 'out' }, path: 'line', dur: 0.6 },
);

const BOOK = symmetric(
  {
    id: 'book',
    gloss: 'BOOK',
    english: 'book',
    category: 'things',
    difficulty: 2,
    howTo: 'Press your palms together, then open them like a book, keeping your little fingers together.',
  },
  K({ shape: 'open-B', at: [0.012, -0.32, -0.3], contact: 'palm', palm: 'contra', fingers: 'out' }),
  { to: { palm: 'up', offset: [0.05, -0.02, 0] }, path: 'line', dur: 0.5 },
);

const HOME = oneHanded(
  {
    id: 'home',
    gloss: 'HOME',
    english: 'home',
    category: 'things',
    difficulty: 2,
    howTo: 'Bunch your fingertips, touch them to your cheek by your mouth, then touch higher up on your cheek.',
    hint: 'Where you eat, and where you sleep.',
  },
  K({ shape: 'flat-O', at: 'cheek', offset: [-0.015, -0.035, -0.01], contact: 'fingertips', palm: 'in', fingers: 'contra' }),
  { to: { at: 'cheek', offset: [0.015, 0.02, 0.02] }, path: 'arc', lift: [0.0, 0.0, -0.03], dur: 0.5 },
);

const BATHROOM = oneHanded(
  {
    id: 'bathroom',
    gloss: 'BATHROOM',
    english: 'bathroom / potty',
    category: 'needs',
    difficulty: 2,
    howTo: 'Make a T (thumb tucked between your first two fingers) and shake it side to side.',
    hint: 'T for toilet.',
  },
  K({ shape: 'T', at: SHOULDER_FRONT, palm: 'out', fingers: 'up' }),
  { path: 'shake', axis: 'wag', amplitude: 22, repeat: 2 },
);

// ---------------------------------------------------------------------------
// Unit 5. Feelings & care
// ---------------------------------------------------------------------------

const HAPPY = oneHanded(
  {
    id: 'happy',
    gloss: 'HAPPY',
    english: 'happy',
    category: 'feelings',
    difficulty: 1,
    howTo: 'Brush your flat hand upward on your chest in little circles, with a happy face.',
    hint: 'Joy bubbling up.',
  },
  K({ shape: 'open-B', at: 'chest', contact: 'palm', palm: 'in', fingers: 'contra' }),
  { path: 'circle', plane: 'side', radius: 0.035, repeat: 2 },
);

const SAD = symmetric(
  {
    id: 'sad',
    gloss: 'SAD',
    english: 'sad',
    category: 'feelings',
    difficulty: 2,
    howTo: 'Hold both open hands in front of your face, palms towards you, and draw them slowly down.',
    hint: 'A long face.',
  },
  K({ shape: '5', at: 'eyes', offset: [0.04, 0.0, -0.08], contact: 'palm', palm: 'in', fingers: 'up' }),
  { to: { at: 'chin', offset: [0.04, -0.02, -0.08] }, path: 'line', dur: 0.8 },
);

const HURT = symmetric(
  {
    id: 'hurt',
    gloss: 'HURT',
    english: 'hurt / pain',
    category: 'feelings',
    difficulty: 2,
    howTo: 'Point your two index fingers at each other and jab them towards each other twice, near where it hurts.',
  },
  K({ shape: '1', at: [0.05, -0.3, -0.3], contact: 'index-tip', palm: 'in', fingers: 'contra' }),
  { path: 'tap', direction: 'ipsi', amplitude: 0.035, repeat: 2 },
);

const HELP = twoHanded(
  {
    id: 'help',
    gloss: 'HELP',
    english: 'help',
    category: 'actions',
    difficulty: 2,
    howTo: 'Rest your thumbs-up fist on your other flat palm and lift both hands up together.',
    hint: 'Giving someone a lift.',
  },
  {
    start: K({ shape: 'open-A', at: [-0.01, -0.39, -0.3], contact: 'pinky-side', palm: 'contra', fingers: 'out' }),
    moves: [{ to: { offset: [0, 0.13, 0] }, path: 'line', dur: 0.55 }],
  },
  {
    start: K({ shape: 'open-B', at: [-0.02, -0.41, -0.3], contact: 'palm', palm: 'up', fingers: 'out-ipsi' }),
    moves: [{ to: { offset: [0, 0.13, 0] }, path: 'line', dur: 0.55 }],
  },
);

const HOT = oneHanded(
  {
    id: 'hot',
    gloss: 'HOT',
    english: 'hot',
    category: 'descriptions',
    difficulty: 2,
    howTo: 'Hold a clawed hand in front of your mouth, then quickly twist it away and down. like taking out something too hot.',
  },
  K({ shape: 'claw', at: 'mouth', offset: [0, -0.01, -0.05], contact: 'palm', palm: 'in', fingers: 'up' }),
  { to: { at: 'neutral', offset: [0.06, 0.08, 0.05], palm: 'out-down', fingers: 'up-out' }, path: 'line', dur: 0.45 },
);

const COLD = symmetric(
  {
    id: 'cold',
    gloss: 'COLD',
    english: 'cold',
    category: 'descriptions',
    difficulty: 1,
    howTo: 'Make two fists in front of your shoulders and shake them towards each other, like shivering.',
  },
  K({ shape: 'S', at: [0.11, -0.25, -0.24], palm: 'contra', fingers: 'up' }),
  { path: 'tap', direction: 'contra', amplitude: 0.025, repeat: 3, dur: 0.9 },
);

const PLAY = symmetric(
  {
    id: 'play',
    gloss: 'PLAY',
    english: 'play',
    category: 'actions',
    difficulty: 1,
    howTo: 'Make Y-hands (thumb and little finger out) and twist them back and forth at the wrists.',
  },
  K({ shape: 'Y', at: [0.15, -0.3, -0.28], palm: 'in', fingers: 'contra' }),
  { path: 'shake', amplitude: 30, repeat: 2 },
);

// ---------------------------------------------------------------------------
// Unit 6. Manners
// ---------------------------------------------------------------------------

const PLEASE = oneHanded(
  {
    id: 'please',
    gloss: 'PLEASE',
    english: 'please',
    category: 'courtesy',
    difficulty: 1,
    howTo: 'Place your flat hand on the middle of your chest and rub it in small circles.',
  },
  K({ shape: 'open-B', at: 'chest', contact: 'palm', palm: 'in', fingers: 'contra-up' }),
  { path: 'circle', plane: 'front', radius: 0.035, repeat: 2 },
);

const SORRY = oneHanded(
  {
    id: 'sorry',
    gloss: 'SORRY',
    english: 'sorry',
    category: 'courtesy',
    difficulty: 1,
    howTo: 'Make an A-hand (a fist with your thumb at the side) and rub it in circles on your chest, looking apologetic.',
  },
  K({ shape: 'A', at: 'chest', contact: 'palm', palm: 'in', fingers: 'contra' }),
  { path: 'circle', plane: 'front', radius: 0.035, repeat: 2 },
);

const YES = oneHanded(
  {
    id: 'yes',
    gloss: 'YES',
    english: 'yes',
    category: 'courtesy',
    difficulty: 1,
    howTo: 'Make a fist and nod it up and down at the wrist, like a head nodding "yes".',
  },
  K({ shape: 'S', at: SHOULDER_FRONT, palm: 'out-down', fingers: 'up-out' }),
  { path: 'nod', amplitude: 35, repeat: 2 },
);

const NO = oneHanded(
  {
    id: 'no',
    gloss: 'NO',
    english: 'no',
    category: 'courtesy',
    difficulty: 2,
    howTo: 'Hold your index and middle fingers together above your thumb, then snap them shut onto the thumb, twice.',
    hint: 'Like a little mouth saying "no".',
  },
  K({ shape: 'NO-open', at: SHOULDER_FRONT, palm: 'out-down', fingers: 'up-out' }),
  { to: { shape: 'NO-closed' }, path: 'squeeze', repeat: 2 },
);

const WANT = symmetric(
  {
    id: 'want',
    gloss: 'WANT',
    english: 'want',
    category: 'needs',
    difficulty: 2,
    howTo: 'Hold both hands palm-up with fingers spread, then pull them towards you while curling your fingers into claws.',
  },
  K({ shape: '5', at: [0.14, -0.4, -0.36], palm: 'up', fingers: 'out' }),
  { to: { shape: 'claw', at: [0.14, -0.38, -0.21] }, path: 'line', dur: 0.55 },
);

const AGAIN = twoHanded(
  {
    id: 'again',
    gloss: 'AGAIN',
    english: 'again',
    category: 'actions',
    difficulty: 3,
    howTo: 'Hold one hand flat, palm up. Bend your other hand at the knuckles and arc it over so the fingertips land in the flat palm.',
  },
  {
    start: K({ shape: 'bent-B', at: [0.1, -0.36, -0.3], contact: 'fingertips', palm: 'up', fingers: 'contra' }),
    moves: [
      {
        to: { at: [-0.04, -0.375, -0.3], palm: 'down-contra', fingers: 'contra-up' },
        path: 'arc',
        lift: [0, 0.09, 0],
        dur: 0.6,
      },
    ],
  },
  {
    start: K({ shape: 'open-B', at: [-0.05, -0.4, -0.3], contact: 'palm', palm: 'up', fingers: 'out' }),
    moves: [{ path: 'hold', dur: 0.6 }],
  },
);

const STOP = twoHanded(
  {
    id: 'stop',
    gloss: 'STOP',
    english: 'stop',
    category: 'actions',
    difficulty: 2,
    howTo: 'Hold one hand flat, palm up, and chop the edge of your other flat hand sharply down onto it.',
  },
  {
    start: K({ shape: 'open-B', at: [-0.03, -0.24, -0.3], contact: 'pinky-side', palm: 'contra', fingers: 'out' }),
    moves: [{ to: { at: [-0.03, -0.385, -0.3] }, path: 'line', dur: 0.3 }],
  },
  {
    start: K({ shape: 'open-B', at: [-0.04, -0.41, -0.3], contact: 'palm', palm: 'up', fingers: 'out-ipsi' }),
    moves: [{ path: 'hold', dur: 0.3 }],
  },
);

const WAIT = twoHanded(
  {
    id: 'wait',
    gloss: 'WAIT',
    english: 'wait',
    category: 'actions',
    difficulty: 2,
    howTo: 'Hold both hands up off to one side, palms up, one a little in front of the other, and wiggle your fingers.',
  },
  {
    start: K({ shape: '5', at: [-0.04, -0.34, -0.38], palm: 'up-in', fingers: 'out-contra' }),
    moves: [{ path: 'wiggle', repeat: 3, dur: 1.0 }],
  },
  {
    start: K({ shape: '5', at: [-0.2, -0.36, -0.3], palm: 'up-in', fingers: 'out-contra' }),
    moves: [{ path: 'wiggle', repeat: 3, dur: 1.0 }],
  },
);

// ---------------------------------------------------------------------------
// Unit 7. Little conversations
// ---------------------------------------------------------------------------

const GOOD = oneHanded(
  {
    id: 'good',
    gloss: 'GOOD',
    english: 'good',
    category: 'descriptions',
    difficulty: 1,
    howTo: 'Touch your fingertips to your chin, then bring your flat hand down and forward so the palm ends facing up.',
    hint: 'Like THANK-YOU, but it drops lower.',
  },
  K({ shape: 'open-B', at: 'chin', contact: 'fingertips', palm: 'in', fingers: 'up' }),
  { to: { at: 'neutral', offset: [0.0, -0.04, 0.06], palm: 'up', fingers: 'out' }, path: 'arc', lift: [0, 0.0, -0.05], dur: 0.6 },
);

const BAD = oneHanded(
  {
    id: 'bad',
    gloss: 'BAD',
    english: 'bad',
    category: 'descriptions',
    difficulty: 1,
    howTo: 'Touch your fingertips to your chin, then swing your hand down and flip it palm-down, with a frown.',
  },
  K({ shape: 'open-B', at: 'chin', contact: 'fingertips', palm: 'in', fingers: 'up' }),
  { to: { at: 'neutral', offset: [0.02, -0.04, 0.05], palm: 'down', fingers: 'out' }, path: 'arc', lift: [0, 0, -0.05], dur: 0.55 },
);

const FINE = oneHanded(
  {
    id: 'fine',
    gloss: 'FINE',
    english: 'fine',
    category: 'descriptions',
    difficulty: 1,
    howTo: 'Spread your hand open and tap your thumb on your upper chest, twice.',
  },
  K({ shape: '5', at: 'chest', offset: [0, 0.07, 0], contact: 'thumb-tip', palm: 'contra', fingers: 'up' }),
  { path: 'tap', direction: 'out', amplitude: 0.035, repeat: 2 },
);

const NICE = twoHanded(
  {
    id: 'nice',
    gloss: 'NICE',
    english: 'nice / clean',
    category: 'descriptions',
    difficulty: 2,
    howTo: 'Slide your flat hand across your other upturned palm, from the heel to past the fingertips.',
  },
  {
    start: K({ shape: 'open-B', at: [-0.03, -0.39, -0.22], contact: 'palm', palm: 'down', fingers: 'out-contra' }),
    moves: [{ to: { at: [-0.03, -0.39, -0.42] }, path: 'line', dur: 0.5 }],
  },
  {
    start: K({ shape: 'open-B', at: [-0.04, -0.41, -0.3], contact: 'palm', palm: 'up', fingers: 'out-ipsi' }),
    moves: [{ path: 'hold', dur: 0.5 }],
  },
);

const MEET = symmetric(
  {
    id: 'meet',
    gloss: 'MEET',
    english: 'meet',
    category: 'actions',
    difficulty: 1,
    howTo: 'Hold up both index fingers apart, palms facing each other, and bring your hands together until they meet.',
    hint: 'Two people meeting.',
  },
  K({ shape: '1', at: [0.15, -0.3, -0.3], palm: 'contra', fingers: 'up' }),
  { to: { at: [0.035, -0.3, -0.3] }, path: 'line', dur: 0.5 },
);

const WHAT = symmetric(
  {
    id: 'what',
    gloss: 'WHAT',
    english: 'what',
    category: 'questions',
    difficulty: 1,
    howTo: 'Hold both open hands palms-up in front of you and shake them slightly. with your eyebrows lowered.',
  },
  K({ shape: '5', at: [0.14, -0.4, -0.3], palm: 'up', fingers: 'out' }),
  { path: 'shake', amplitude: 22, repeat: 2 },
);

const WHERE = oneHanded(
  {
    id: 'where',
    gloss: 'WHERE',
    english: 'where',
    category: 'questions',
    difficulty: 1,
    howTo: 'Hold up your index finger and shake it side to side. with your eyebrows lowered.',
  },
  K({ shape: '1', at: SHOULDER_FRONT, palm: 'out', fingers: 'up' }),
  { path: 'shake', axis: 'wag', amplitude: 24, repeat: 2 },
);

const UNDERSTAND = oneHanded(
  {
    id: 'understand',
    gloss: 'UNDERSTAND',
    english: 'understand',
    category: 'questions',
    difficulty: 2,
    howTo: 'Hold your hand beside your forehead with your index finger curled under your thumb, then flick it up. like a light bulb turning on.',
  },
  K({ shape: 'flick-X', at: 'temple', offset: [0.02, -0.01, -0.03], contact: 'knuckles', palm: 'in', fingers: 'up' }),
  { to: { shape: '1' }, path: 'line', dur: 0.25 },
  { path: 'hold', dur: 0.3 },
);

// ---------------------------------------------------------------------------
// Unit 8. Pets
// ---------------------------------------------------------------------------

const DOG = oneHanded(
  {
    id: 'dog',
    gloss: 'DOG',
    english: 'dog',
    category: 'things',
    difficulty: 1,
    howTo: 'Pat the side of your leg twice, as if calling a dog. (Many signers also snap their fingers.)',
    variants: 'The dictionary form snaps the fingers twice; patting the thigh is very common with babies and toddlers.',
  },
  K({ shape: 'open-B', at: [0.2, -0.52, -0.3], contact: 'palm', palm: 'down', fingers: 'out' }),
  { path: 'tap', direction: 'up', amplitude: 0.06, repeat: 2 },
);

const CAT = oneHanded(
  {
    id: 'cat',
    gloss: 'CAT',
    english: 'cat',
    category: 'things',
    difficulty: 2,
    howTo: 'Beside your mouth, pinch your thumb and index finger together and pull outwards, like stroking whiskers.',
  },
  K({ shape: 'open-F', at: 'cheek', offset: [0.005, -0.03, -0.02], contact: 'thumb-tip', palm: 'contra', fingers: 'up' }),
  { to: { shape: 'F', offset: [0.12, -0.03, -0.03] }, path: 'line', dur: 0.5 },
);

// ---------------------------------------------------------------------------
// Fingerspelling & numbers
// ---------------------------------------------------------------------------

/** Where fingerspelling happens: in front of the dominant shoulder. */
const SPELL_AT: [number, number, number] = [0.15, -0.2, -0.32];

function letter(ch: string, key: Partial<HandKey> = {}, moves: Segment[] = [{ path: 'hold', dur: 0.6 }]): SignDef {
  return oneHanded(
    {
      id: `letter-${ch.toLowerCase()}`,
      gloss: ch,
      english: `letter ${ch}`,
      category: 'fingerspelling',
      difficulty: 1,
      howTo: '',
    },
    K({ shape: ch, at: SPELL_AT, palm: 'out', fingers: 'up', ...key }),
    ...moves,
  );
}

const SIDEWAYS: Partial<HandKey> = { palm: 'in', fingers: 'contra' };
const POINT_DOWN: Partial<HandKey> = { palm: 'in-down', fingers: 'down-out' };

export const LETTERS: SignDef[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => {
  switch (ch) {
    case 'C':
    case 'O':
      return letter(ch, { palm: 'contra-out', fingers: 'up' });
    case 'G':
    case 'H':
      return letter(ch, SIDEWAYS);
    case 'P':
      return letter(ch, { shape: 'K', ...POINT_DOWN });
    case 'Q':
      return letter(ch, { shape: 'G', ...POINT_DOWN });
    case 'J':
      return letter(ch, { shape: 'I', palm: 'out', fingers: 'up' }, [
        { to: { palm: 'in', fingers: 'up', offset: [-0.03, -0.05, 0.02] }, path: 'arc', lift: [0.02, -0.03, 0], dur: 0.6 },
      ]);
    case 'Z':
      return letter(ch, { shape: '1', contact: 'index-tip' }, [
        { to: { offset: [0.07, 0, 0] }, path: 'line', dur: 0.25 },
        { to: { offset: [0.0, -0.06, 0] }, path: 'line', dur: 0.25 },
        { to: { offset: [0.07, -0.06, 0] }, path: 'line', dur: 0.25 },
      ]);
    default:
      return letter(ch);
  }
}).map((d) => {
  const hs = d.dominant.start.shape;
  return { ...d, howTo: `Fingerspell ${d.gloss}.`, hint: hs };
});

export const NUMBERS: SignDef[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((n) => {
  const palmIn = +n <= 5;
  const moves: Segment[] = n === '10' ? [{ path: 'shake', amplitude: 25, repeat: 2 }] : [{ path: 'hold', dur: 0.6 }];
  return oneHanded(
    {
      id: `number-${n}`,
      gloss: n,
      english: `number ${n}`,
      category: 'numbers',
      difficulty: 1,
      howTo: palmIn ? `Show ${n} with your palm facing you.` : `Show ${n} with your palm facing out.`,
    },
    K({
      shape: n,
      at: SPELL_AT,
      palm: n === '10' ? 'contra' : palmIn ? 'in' : 'out',
      fingers: n === '10' ? 'out' : 'up',
    }),
    ...moves,
  );
});

// ---------------------------------------------------------------------------

export const SIGNS: SignDef[] = [
  HELLO,
  THANK_YOU,
  I_LOVE_YOU,
  MORE,
  EAT,
  DRINK,
  MILK,
  WATER,
  FINISH,
  HUNGRY,
  MOTHER,
  FATHER,
  BABY,
  LOVE,
  FAMILY,
  ME,
  YOU,
  MY,
  YOUR,
  NAME,
  BATH,
  SLEEP,
  TIRED,
  BOOK,
  HOME,
  BATHROOM,
  HAPPY,
  SAD,
  HURT,
  HELP,
  HOT,
  COLD,
  PLAY,
  PLEASE,
  SORRY,
  YES,
  NO,
  WANT,
  AGAIN,
  STOP,
  WAIT,
  GOOD,
  BAD,
  FINE,
  NICE,
  MEET,
  WHAT,
  WHERE,
  UNDERSTAND,
  DOG,
  CAT,
].map((s) => withNotes(s));

export const ALL_SIGNS: SignDef[] = [...SIGNS, ...LETTERS, ...NUMBERS];

/**
 * Onboarding demonstration, not a sign: the index fingertip touches the chin
 * and holds (used to calibrate face landmarks). Not part of the catalog.
 */
export const CHIN_TOUCH: SignDef = oneHanded(
  {
    id: 'chin-touch',
    gloss: 'CHIN TOUCH',
    english: 'touch your chin',
    category: 'greetings',
    difficulty: 1,
    howTo: 'Touch your chin with your index finger and hold it there for a moment.',
  },
  K({ shape: '1', at: 'chin', contact: 'index-tip', palm: 'in', fingers: 'up' }),
  { path: 'hold', dur: 1.2 },
);

const BY_ID = new Map(ALL_SIGNS.map((s) => [s.id, s]));

export function getSign(id: string): SignDef {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown sign "${id}"`);
  return s;
}

export function findSign(id: string): SignDef | undefined {
  return BY_ID.get(id);
}
