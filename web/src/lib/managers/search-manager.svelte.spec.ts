import type { MetadataSearchDto } from '@immich/sdk';
import { goto } from '$app/navigation';
import { searchManager } from '$lib/managers/search-manager.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const gotoMock = vi.mocked(goto);

const submittedDto = (call = 0) => {
  const url = gotoMock.mock.calls[call][0] as string;
  const raw = new URL(url, 'http://localhost').searchParams.get('query');
  return raw ? JSON.parse(raw) : {};
};

describe('searchManager tag filters', () => {
  afterEach(() => {
    gotoMock.mockClear();
    searchManager.reset();
  });

  it('round-trips tags and the match mode through the URL dto', async () => {
    searchManager.setQuery({ tagIds: ['tag-1'], tagMatch: 'any' });
    await searchManager.submit();

    const dto = submittedDto();
    expect(dto).toMatchObject({ tagIds: ['tag-1'], tagMatch: 'any' });

    searchManager.reset();
    searchManager.setQuery(dto);
    expect([...(searchManager.filter.tagIds ?? [])]).toEqual(['tag-1']);
    expect(searchManager.filter.tagMatch).toBe('any');
  });

  it('serializes the default match mode for selected tags', async () => {
    searchManager.setQuery({ tagIds: ['tag-1'] });
    await searchManager.submit();

    expect(submittedDto()).toMatchObject({ tagIds: ['tag-1'], tagMatch: 'all' });
  });

  it('omits tagMatch when no tags are selected', async () => {
    searchManager.setQuery({ personIds: ['person-1'] });
    await searchManager.submit();

    const dto = submittedDto();
    expect(dto.tagMatch).toBeUndefined();
    expect(dto.tagIds).toBeUndefined();
  });

  it('preserves untagged (tagIds: null) without a match mode', async () => {
    searchManager.setQuery({ tagIds: null });
    await searchManager.submit();

    const dto = submittedDto();
    expect(dto.tagIds).toBeNull();
    expect(dto.tagMatch).toBeUndefined();

    searchManager.reset();
    searchManager.setQuery(dto);
    expect(searchManager.filter.tagIds).toBeNull();
    expect(searchManager.filter.tagMatch).toBe('all');
  });

  it('ignores an invalid match mode from the URL', () => {
    searchManager.setQuery({ tagIds: ['tag-1'], tagMatch: 'sometimes' } as unknown as MetadataSearchDto);

    expect(searchManager.filter.tagMatch).toBe('all');
  });

  it('keeps tag filters composed with other search filters', async () => {
    searchManager.setQuery({ tagIds: ['tag-1'], tagMatch: 'none', city: 'Ghent', rating: 4, isFavorite: true });
    await searchManager.submit();

    expect(submittedDto()).toMatchObject({
      tagIds: ['tag-1'],
      tagMatch: 'none',
      city: 'Ghent',
      rating: 4,
      isFavorite: true,
    });
  });
});
