import { AssetTypeEnum, AssetVisibility } from '@immich/sdk';
import type { TagSearchDto } from '$lib/types';
import { buildTagIdsFilter, isTagMatchMode, toApiSearchDto } from '$lib/utils/tag-search';

describe('tag-search', () => {
  describe('isTagMatchMode', () => {
    it('accepts only the three match modes', () => {
      expect(isTagMatchMode('all')).toBe(true);
      expect(isTagMatchMode('any')).toBe(true);
      expect(isTagMatchMode('none')).toBe(true);
      expect(isTagMatchMode('some')).toBe(false);
      expect(isTagMatchMode(undefined)).toBe(false);
    });
  });

  describe('buildTagIdsFilter', () => {
    it('deduplicates ids and uses the requested operator', () => {
      expect(buildTagIdsFilter(['a', 'a', 'b'], 'any')).toEqual({ any: ['a', 'b'] });
      expect(buildTagIdsFilter(['a'], 'none')).toEqual({ none: ['a'] });
    });

    it('returns an empty filter without ids', () => {
      expect(buildTagIdsFilter([], 'all')).toEqual({});
    });
  });

  describe('toApiSearchDto', () => {
    it('keeps the flat dto (minus tagMatch) when no tags are selected', () => {
      const dto: TagSearchDto = { withExif: true, personIds: ['p1'], tagMatch: 'any' };
      const result = toApiSearchDto(dto);

      expect(result).toEqual({ withExif: true, personIds: ['p1'] });
      expect(result.filter).toBeUndefined();
    });

    it('keeps untagged (tagIds: null) on the flat shape', () => {
      const result = toApiSearchDto({ tagIds: null, tagMatch: 'any', withExif: true });

      expect(result).toEqual({ tagIds: null, withExif: true });
      expect(result.filter).toBeUndefined();
    });

    it('maps all/any/none to the structured tagIds filter', () => {
      expect(toApiSearchDto({ tagIds: ['t1', 't2'], tagMatch: 'any' }).filter?.tagIds).toEqual({
        any: ['t1', 't2'],
      });
      expect(toApiSearchDto({ tagIds: ['t1', 't2'], tagMatch: 'none' }).filter?.tagIds).toEqual({
        none: ['t1', 't2'],
      });
      expect(toApiSearchDto({ tagIds: ['t1', 't2'], tagMatch: 'all' }).filter?.tagIds).toEqual({
        all: ['t1', 't2'],
      });
      expect(toApiSearchDto({ tagIds: ['t1', 't2'] }).filter?.tagIds).toEqual({ all: ['t1', 't2'] });
    });

    it('composes people, date, rating, visibility, favorite, album and media filters', () => {
      const result = toApiSearchDto({
        tagIds: ['t1'],
        tagMatch: 'all',
        personIds: ['p1', 'p2'],
        takenAfter: '2026-03-01T00:00:00.000Z',
        takenBefore: '2026-03-31T23:59:59.999Z',
        rating: 5,
        visibility: AssetVisibility.Archive,
        isFavorite: true,
        isNotInAlbum: true,
        type: AssetTypeEnum.Image,
        city: 'Ghent',
        country: null,
        make: 'Fujifilm',
      });

      expect(result.filter).toEqual({
        tagIds: { all: ['t1'] },
        personIds: { all: ['p1', 'p2'] },
        takenAt: { gte: '2026-03-01T00:00:00.000Z', lte: '2026-03-31T23:59:59.999Z' },
        rating: { eq: 5 },
        visibility: { eq: AssetVisibility.Archive },
        isFavorite: { eq: true },
        hasAlbums: { eq: false },
        type: { eq: AssetTypeEnum.Image },
        city: { eq: 'Ghent' },
        country: { eq: null },
        make: { eq: 'Fujifilm' },
      });
      expect(result.page).toBeUndefined();
      expect(result.order).toBeUndefined();
      expect(result.visibility).toBeUndefined();
      expect(result.personIds).toBeUndefined();
    });

    it('maps a null rating (unrated) to eq null', () => {
      expect(toApiSearchDto({ tagIds: ['t1'], rating: null }).filter?.rating).toEqual({ eq: null });
    });

    it('maps the flat text query fields into structured pattern filters', () => {
      expect(toApiSearchDto({ tagIds: ['t1'], originalFileName: 'img_1234' }).filter?.originalFileName).toEqual({
        like: 'img_1234',
      });
      expect(toApiSearchDto({ tagIds: ['t1'], description: 'concert' }).filter?.description).toEqual({
        like: 'concert',
      });
      expect(toApiSearchDto({ tagIds: ['t1'], originalPath: '/photos/2026' }).filter?.originalPath).toEqual({
        like: '/photos/2026',
      });
      expect(toApiSearchDto({ tagIds: ['t1'], ocr: 'BALHALLA' }).filter?.ocr).toEqual({ matches: 'BALHALLA' });
    });

    it('keeps smart query fields at the top level', () => {
      const result = toApiSearchDto({ tagIds: ['t1'], query: 'dancing', queryAssetId: 'a1', language: 'en' });

      expect(result.query).toBe('dancing');
      expect(result.queryAssetId).toBe('a1');
      expect(result.language).toBe('en');
      expect(result.filter?.tagIds).toEqual({ all: ['t1'] });
    });

    it('does not mutate the input dto', () => {
      const dto: TagSearchDto = { tagIds: ['t1'], tagMatch: 'none' };
      toApiSearchDto(dto);
      expect(dto.tagMatch).toBe('none');
    });
  });
});
