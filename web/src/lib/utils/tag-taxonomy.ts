// Static snapshot of the category/tag order from the bridge tagger taxonomy
// (ImmichDriveBridge/tools/tagger/tags.json). It drives badge chip ordering and the
// tag picker categories: known tags come first in taxonomy order, unknown tags after
// them (alphabetically). Keep in sync manually.
export interface TagCategory {
  name: string;
  color: string;
  tags: string[];
}

export const TAG_CATEGORIES: TagCategory[] = [
  {
    name: 'People & Appearance',
    color: '#e11d48',
    tags: [
      'MOUSTACHE',
      'BEARD',
      'HAIR',
      'BALD',
      'BRAIDS',
      'GLASSES',
      'EARRINGS',
      'PIERCING',
      'TATTOO',
      'HAT',
      'MAN',
      'WOMAN',
      'CHILD',
      'MAN_IN_SKIRT',
      'SINGER',
      'OLD',
      'YOUNG',
    ],
  },
  {
    name: 'Relationships & Interaction',
    color: '#db2777',
    tags: [
      'COUPLE',
      'WOMEN_COUPLE',
      'MEN_COUPLE',
      'MIXED_COUPLE',
      'HOLDING_HANDS',
      'HANDS',
      'EMBRACE_DANCE',
      'HUG',
      'KISS',
      'TALKING',
      'SMILE_LAUGHING',
      'EYES_EYE_GAZE',
      'BACK_EYES_CLOSED',
      'CALLING',
      'MASSAGE_TRAIN',
      'BOARDGAMES',
    ],
  },
  {
    name: 'Clothing & Accessories',
    color: '#9333ea',
    tags: [
      'DRESS',
      'DRESS_SHIRT',
      'TRANS_DRESS',
      'T-SHIRT',
      'KILT',
      'TWINKLES',
      'Band',
      'DUO',
      'TRIO',
      'QUARTET',
      'QUINTET',
      'SEXTET',
      'SCORES',
    ],
  },
  {
    name: 'Music & Instruments',
    color: '#2563eb',
    tags: [
      'FLUTE',
      'CELLO',
      'VIOLIN',
      'BAGPIPE',
      'SAX',
      'CLARINET',
      'GUITAR',
      'NYCKELHARPA',
      'PERCUSSION',
      'PIANO',
      'HURDY_GURDY',
      'ACCORDEON',
    ],
  },
  {
    name: 'Dance & Musical Forms',
    color: '#0891b2',
    tags: [
      'JAM',
      'JIG',
      'BOURREE2T_BOURREE3T',
      'MAGIC_CIRCLE',
      'SCOTTISH',
      'RONDEAU',
      'GAVOTTE',
      'MAZURKA',
      'WALTZ',
      'ANDRO',
      'HANTER_DRO',
      'CHAINDANCE',
      'SMALL_CIRCLES',
    ],
  },
  {
    name: 'Event Spaces & Environment',
    color: '#059669',
    tags: [
      'VIEW_FROM_STAGE',
      'OPEN_STAGE',
      'DANCEFLOOR',
      'BAR',
      'VOLUNTEER_AREA',
      'BACKSTAGE',
      'AUDIENCE',
      'MAIN_STAGE',
      'SOFA',
      'CHAIR',
      'SKYLINE',
      'FOOD',
      'DRINK_BEER',
      'BUILDUP',
      'TEARDOWN',
      'WORKSHOP',
      'VOLUNTEER_ACCOMODATION',
      'SILENT_ROOM',
      'PARTICIPANT_ACCOMODATION',
    ],
  },
  {
    name: 'Event Roles & People',
    color: '#65a30d',
    tags: ['VOLUNTEERS', 'TECHNICIANS', 'TEACHER', 'DANCERS'],
  },
  {
    name: 'Performance & Audio',
    color: '#d97706',
    tags: ['SOUND', 'MICROPHONE', 'ANNOUNCEMENT'],
  },
  {
    name: 'Photography & Cinematography',
    color: '#7c3aed',
    tags: [
      'CAMERA',
      'FILMING',
      'CLOSE-UP',
      'OVERVIEW',
      'LOW_ANGLE',
      'HIGH_ANGLE',
      'BLURRED',
      'DARK',
      'BRIGHT',
      'SHADOW',
      'LIGHTING',
      'BIRDS_EYE',
      'WORMS_EYE',
    ],
  },
  {
    name: 'Objects & Merchandise',
    color: '#0d9488',
    tags: ['CD', 'PHONE', 'STUFFED_ANIMAL', 'DECORATION', 'MOON', 'POSTERWALL', 'SIGNAGE'],
  },
  {
    name: 'Merch',
    color: '#dc2626',
    tags: ['CADANSA', 'BOOMBAL', 'BALHALLA_T-SHIRT', 'BALHALLA_SWEATER', 'BALHALLA_DRESS', 'BRACELET'],
  },
];

export const TAG_TAXONOMY_ORDER: string[] = TAG_CATEGORIES.flatMap((category) => category.tags);

const categoryByTag = new Map(TAG_CATEGORIES.flatMap((category) => category.tags.map((tag) => [tag, category.name])));

const orderByTag = new Map(TAG_TAXONOMY_ORDER.map((name, index) => [name, index]));

export const categoryNameForTag = (tag: string) => categoryByTag.get(tag);

export const compareTagOrder = (a: string, b: string) => {
  const aOrder = orderByTag.get(a) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = orderByTag.get(b) ?? Number.MAX_SAFE_INTEGER;
  return aOrder === bOrder ? a.localeCompare(b) : aOrder - bOrder;
};
