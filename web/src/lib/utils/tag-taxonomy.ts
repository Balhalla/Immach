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
    name: 'Edition',
    color: '#7c2d12',
    tags: ['2026', '2026_MAART'],
  },
  {
    name: 'Organisation',
    color: '#c026d3',
    tags: ['BALAFOLK', 'BALHALLA', 'BALHALLAFESTIVAL'],
  },
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
    name: 'Location',
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
  {
    name: 'Photographer',
    color: '#475569',
    tags: [
      'GABRIELE_SAVA',
      'JOHAN_WIJCHEN',
      'HANNE_COLLETTE',
      'VERENA_MARTENS',
      'HENDRIK_KEGEL',
      'LEMKE',
      'BASILE',
      'DAVID_VAN_RANSBEEK',
      'WIM_DRIES',
    ],
  },
  {
    name: 'Band & Workshop',
    color: '#4f46e5',
    tags: [
      'BAL_O_GADJO',
      'NARAGONIA_QUARTET',
      'ROKKENDE_VROUWEN',
      'WARMOES',
      'BARGAINNAT',
      'DUO_MOBILETTE',
      'FEATHER_AND_FOX',
      'LE_MANGE_BAL',
      'CLARANBAUX',
      'LUVAR',
      'VIOREL',
      'NO_AND_MI',
      'ASSABIYA',
      'ANNA_NEUSS',
      'DUO_ALSO',
      'PULSAR',
      'COUP_DE_FOUDRE',
      'FOLKIN_JONG',
      'BRUUDDUUS',
      'BAL_ARTISANAL',
      'WORKSHOP_NATALIA_KLAMANN_WHEN_2_IS_NOT_ENOUGH',
      'WORKSHOP_BRETON_DANCES',
      'WORKSHOP_ANITA_VLAAMSE_DANSEN',
      'WORKSHOP_TIM_AND_EMILY_INTRODUCTION_TO_BALFOLK',
      'WORKSHOP_ELENA_BREATHING_CIRCLES',
      'WORKSHOP_DIATONIC_ACCORDION_MELODY_CHORDS_AND_ENSEMBLE_PLAYING',
      'WORKSHOP_HILDE_SINGING',
      'WORKSHOP_ELENA_BOUREE_AUVERGNATE',
      'WORKSHOP_LOUISE_AND_JORIS_CONNECTION_IN_GROUP_DANCES',
      'WORKSHOP_STEFAN_RONDEAU_GASCOGNE',
      'WORKSHOP_EUROPEAN_DANCE_MUSIC_BY_EAR',
      'WORKSHOP_KOEN_DHONDT_MUZIKALITEIT_VOOR_DANSERS',
      'WORKSHOP_TIM_AND_EMILY',
    ],
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

// Lower rank sorts first: Photographer (0), Edition (1), then every other
// known/unknown tag (2) in taxonomy order.
export const tagDisplayRank = (tag: string) => {
  const category = categoryNameForTag(tag);
  if (category === 'Photographer') {
    return 0;
  }
  if (category === 'Edition') {
    return 1;
  }
  return 2;
};

// Photographer chip first, then Edition, then the rest in taxonomy order.
export const compareTagDisplayOrder = (a: string, b: string) =>
  tagDisplayRank(a) - tagDisplayRank(b) || compareTagOrder(a, b);

const colorByCategory = new Map(TAG_CATEGORIES.map((category) => [category.name, category.color]));

export const categoryColorForTag = (tag: string): string | undefined => {
  const category = categoryNameForTag(tag);
  return category === undefined ? undefined : colorByCategory.get(category);
};
