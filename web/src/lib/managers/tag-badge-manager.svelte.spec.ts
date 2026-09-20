import type { TagResponseDto } from '@immich/sdk';
import { sdkMock } from '$lib/__mocks__/sdk.mock';
import { tagBadgeManager } from '$lib/managers/tag-badge-manager.svelte';

const tag = (id: string, value: string): TagResponseDto => ({
  id,
  name: value,
  value,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const searchAssetsResponse = (assetId: string) =>
  ({
    albums: { total: 0, count: 0, items: [], facets: [] },
    assets: { total: 1, count: 1, items: [{ id: assetId }], nextPage: null },
  }) as unknown as Awaited<ReturnType<typeof sdkMock.searchAssets>>;

describe('tagBadgeManager sorting', () => {
  beforeEach(() => {
    sdkMock.getAllTags.mockResolvedValue([
      tag('t-animal', 'STUFFED_ANIMAL'),
      tag('t-band', 'NARAGONIA_QUARTET_2026'),
      tag('t-edition', '2026'),
      tag('t-photo', 'JOHAN_WIJCHEN'),
      tag('t-people', 'MOUSTACHE'),
    ]);
    sdkMock.searchAssets.mockResolvedValue(searchAssetsResponse('a1'));
  });

  afterEach(() => {
    sdkMock.getAllTags.mockReset();
    sdkMock.searchAssets.mockReset();
  });

  it('orders photographer first, then edition, then taxonomy order', async () => {
    tagBadgeManager.ensureLoaded();
    await vi.waitFor(() => expect(tagBadgeManager.status).toBe('ready'));

    expect(tagBadgeManager.tagsFor('a1').map((entry) => entry.value)).toEqual([
      'JOHAN_WIJCHEN',
      '2026',
      'MOUSTACHE',
      'STUFFED_ANIMAL',
      'NARAGONIA_QUARTET_2026',
    ]);
  });
});
