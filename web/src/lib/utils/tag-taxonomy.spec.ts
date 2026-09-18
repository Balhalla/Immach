import { categoryColorForTag, compareTagDisplayOrder, tagDisplayRank } from '$lib/utils/tag-taxonomy';

describe('tag-taxonomy display order', () => {
  it('ranks photographers first, then editions, then everything else', () => {
    expect(tagDisplayRank('JOHAN_WIJCHEN')).toBe(0);
    expect(tagDisplayRank('HANNE_COLLETTE')).toBe(0);
    expect(tagDisplayRank('BALHALLAFESTIVAL_2026')).toBe(1);
    expect(tagDisplayRank('NARAGONIA_QUARTET')).toBe(2);
    expect(tagDisplayRank('UNKNOWN_TAG')).toBe(2);
  });

  it('sorts photographer > edition > taxonomy order', () => {
    const sorted = [
      'NARAGONIA_QUARTET',
      'SAX',
      'BALHALLAFESTIVAL_2026',
      'GABRIELE_SAVA',
      'MOUSTACHE',
      'JOHAN_WIJCHEN',
    ].sort(compareTagDisplayOrder);

    expect(sorted).toEqual([
      'GABRIELE_SAVA',
      'JOHAN_WIJCHEN',
      'BALHALLAFESTIVAL_2026',
      'MOUSTACHE',
      'SAX',
      'NARAGONIA_QUARTET',
    ]);
  });

  it('keeps unknown tags after known tags, alphabetically', () => {
    const sorted = ['zebra_tag', 'MOUSTACHE', 'alpha_tag'].sort(compareTagDisplayOrder);

    expect(sorted).toEqual(['MOUSTACHE', 'alpha_tag', 'zebra_tag']);
  });

  it('maps known tags to their category color and unknown tags to undefined', () => {
    expect(categoryColorForTag('JOHAN_WIJCHEN')).toBe('#475569');
    expect(categoryColorForTag('BALHALLAFESTIVAL_2026')).toBe('#7c2d12');
    expect(categoryColorForTag('NARAGONIA_QUARTET')).toBe('#4f46e5');
    expect(categoryColorForTag('UNKNOWN_TAG')).toBeUndefined();
  });
});
