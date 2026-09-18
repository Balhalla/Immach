import type { IdsFilter, SearchFilter } from '@immich/sdk';
import type { TagMatchMode, TagSearchDto } from '$lib/types';

export const TAG_MATCH_MODES: TagMatchMode[] = ['all', 'any', 'none'];

export const isTagMatchMode = (value: unknown): value is TagMatchMode =>
  typeof value === 'string' && (TAG_MATCH_MODES as string[]).includes(value);

export const buildTagIdsFilter = (tagIds: string[], mode: TagMatchMode): IdsFilter => {
  const unique = [...new Set(tagIds)];
  return unique.length === 0 ? {} : { [mode]: unique };
};

const definedFilter = <T extends object>(filter: T): T | undefined =>
  Object.values(filter).some((value) => value !== undefined) ? filter : undefined;

const omitTagMatch = (dto: TagSearchDto): TagSearchDto => {
  const rest = { ...dto };
  delete rest.tagMatch;
  return rest;
};

const stringFilters = (dto: TagSearchDto) => {
  const city = dto.city === undefined ? undefined : { eq: dto.city };
  const state = dto.state === undefined ? undefined : { eq: dto.state };
  const country = dto.country === undefined ? undefined : { eq: dto.country };
  const make = dto.make === undefined ? undefined : { eq: dto.make };
  const model = dto.model === undefined ? undefined : { eq: dto.model };
  const lensModel = dto.lensModel === undefined ? undefined : { eq: dto.lensModel };
  return { city, state, country, make, model, lensModel };
};

const queryFilter = (dto: TagSearchDto): Partial<SearchFilter> => {
  if (dto.ocr) {
    return { ocr: { matches: dto.ocr } };
  }
  if (dto.description) {
    return { description: { like: dto.description } };
  }
  if (dto.originalFileName) {
    return { originalFileName: { like: dto.originalFileName } };
  }
  if (dto.originalPath) {
    return { originalPath: { like: dto.originalPath } };
  }
  return {};
};

/**
 * The web keeps the legacy flat search DTO in the URL (search page chips and old
 * bookmarks keep working). When tags are selected, the deprecated flat fields are
 * rejected by the server in combination with `filter`, so the whole DTO has to be
 * mapped into the v3 structured shape before the API call. Untagged (`tagIds: null`)
 * has no structured equivalent and stays on the flat shape.
 */
export const toApiSearchDto = (dto: TagSearchDto): TagSearchDto => {
  const tagIds = Array.isArray(dto.tagIds) ? dto.tagIds : [];
  if (tagIds.length === 0) {
    return omitTagMatch(dto);
  }

  const mode = isTagMatchMode(dto.tagMatch) ? dto.tagMatch : 'all';
  const filter: SearchFilter = {
    ...stringFilters(dto),
    ...queryFilter(dto),
    tagIds: buildTagIdsFilter(tagIds, mode),
    takenAt: definedFilter({ gte: dto.takenAfter, lte: dto.takenBefore }),
    visibility: definedFilter({ eq: dto.visibility }),
    isFavorite: dto.isFavorite ? { eq: true } : undefined,
    hasAlbums: dto.isNotInAlbum ? { eq: false } : undefined,
    personIds: dto.personIds?.length ? { all: [...new Set(dto.personIds)] } : undefined,
    type: dto.type ? { eq: dto.type } : undefined,
    rating: dto.rating === undefined ? undefined : { eq: dto.rating },
  };

  return {
    query: dto.query,
    queryAssetId: dto.queryAssetId,
    language: dto.language,
    withExif: dto.withExif,
    withPeople: dto.withPeople,
    withStacked: dto.withStacked,
    size: dto.size,
    cursor: dto.cursor,
    filter,
  };
};
