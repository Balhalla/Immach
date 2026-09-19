import {
  categoryColorForTag,
  categoryNameForTag,
  compareTagDisplayOrder,
  tagDisplayRank,
  TAG_CATEGORIES,
} from '$lib/utils/tag-taxonomy';

describe('tag-taxonomy display order', () => {
  it('ranks photographers first, then editions, then everything else', () => {
    expect(tagDisplayRank('JOHAN_WIJCHEN')).toBe(0);
    expect(tagDisplayRank('HANNE_COLLETTE')).toBe(0);
    expect(tagDisplayRank('2026')).toBe(1);
    expect(tagDisplayRank('2026_MAART')).toBe(1);
    expect(tagDisplayRank('BALHALLAFESTIVAL')).toBe(2);
    expect(tagDisplayRank('NARAGONIA_QUARTET')).toBe(2);
    expect(tagDisplayRank('UNKNOWN_TAG')).toBe(2);
  });

  it('sorts photographer > edition > taxonomy order', () => {
    const sorted = ['NARAGONIA_QUARTET', 'SAX', '2026', 'GABRIELE_SAVA', 'MOUSTACHE', 'JOHAN_WIJCHEN'].sort(
      compareTagDisplayOrder,
    );

    expect(sorted).toEqual(['GABRIELE_SAVA', 'JOHAN_WIJCHEN', '2026', 'MOUSTACHE', 'SAX', 'NARAGONIA_QUARTET']);
  });

  it('keeps unknown tags after known tags, alphabetically', () => {
    const sorted = ['zebra_tag', 'MOUSTACHE', 'alpha_tag'].sort(compareTagDisplayOrder);

    expect(sorted).toEqual(['MOUSTACHE', 'alpha_tag', 'zebra_tag']);
  });

  it('maps known tags to their category color and unknown tags to undefined', () => {
    expect(categoryColorForTag('JOHAN_WIJCHEN')).toBe('#475569');
    expect(categoryColorForTag('2026')).toBe('#7c2d12');
    expect(categoryColorForTag('BALHALLAFESTIVAL')).toBe('#c026d3');
    expect(categoryColorForTag('NARAGONIA_QUARTET')).toBe('#4f46e5');
    expect(categoryColorForTag('UNKNOWN_TAG')).toBeUndefined();
  });

  it('carries the renamed Location category, the Organisation tags and the Edition years', () => {
    expect(categoryNameForTag('MAIN_STAGE')).toBe('Location');
    expect(categoryColorForTag('MAIN_STAGE')).toBe('#059669');
    expect(TAG_CATEGORIES.some((category) => category.name === 'Event Spaces & Environment')).toBe(false);
    expect(TAG_CATEGORIES.find((category) => category.name === 'Edition')).toMatchObject({
      color: '#7c2d12',
      tags: ['2026', '2026_MAART'],
    });
    expect(TAG_CATEGORIES.find((category) => category.name === 'Organisation')).toMatchObject({
      color: '#c026d3',
      tags: ['BALAFOLK', 'BALHALLA', 'BALHALLAFESTIVAL'],
    });
    expect(categoryNameForTag('BALHALLAFESTIVAL')).toBe('Organisation');
  });

  it('carries the recategorization: Band_Type, slimmed Location, moved tags', () => {
    expect(TAG_CATEGORIES.find((category) => category.name === 'Band_Type')).toMatchObject({
      color: '#ca8a04',
      tags: ['Band', 'DUO', 'TRIO', 'QUARTET', 'QUINTET', 'SEXTET', 'SCORES'],
    });
    expect(TAG_CATEGORIES.find((category) => category.name === 'Clothing & Accessories')?.tags).toEqual([
      'DRESS',
      'DRESS_SHIRT',
      'TRANS_DRESS',
      'T-SHIRT',
      'KILT',
      'TWINKLES',
    ]);
    expect(TAG_CATEGORIES.find((category) => category.name === 'Location')?.tags).toEqual([
      'OPEN_STAGE',
      'DANCEFLOOR',
      'BAR',
      'VOLUNTEER_AREA',
      'BACKSTAGE',
      'MAIN_STAGE',
      'BUILDUP',
      'TEARDOWN',
      'WORKSHOP',
      'VOLUNTEER_ACCOMODATION',
      'SILENT_ROOM',
      'PARTICIPANT_ACCOMODATION',
    ]);
    expect(categoryNameForTag('DRINK_BEER')).toBe('Relationships & Interaction');
    expect(categoryNameForTag('FOOD')).toBe('Relationships & Interaction');
    expect(categoryNameForTag('AUDIENCE')).toBe('Event Roles & People');
    expect(categoryNameForTag('VIEW_FROM_STAGE')).toBe('Photography & Cinematography');
    expect(categoryNameForTag('SKYLINE')).toBe('Objects & Merchandise');
    expect(categoryNameForTag('SOFA')).toBe('Objects & Merchandise');
    expect(categoryNameForTag('CHAIR')).toBe('Objects & Merchandise');
  });
});
