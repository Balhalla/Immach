import { getAllTags, searchAssets, type TagResponseDto } from '@immich/sdk';
import { SvelteMap } from 'svelte/reactivity';
import { eventManager, type AssetsTagChange } from '$lib/managers/event-manager.svelte';
import { TAG_TAXONOMY_ORDER } from '$lib/utils/tag-taxonomy';

const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CONCURRENCY = 8;
const SEARCH_PAGE_SIZE = 1000;

const taxonomyOrder = new Map(TAG_TAXONOMY_ORDER.map((name, index) => [name, index]));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await delay(300 * 2 ** attempt);
    }
  }
  throw lastError;
};

const runPool = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
};

class TagBadgeManager {
  #tags = $state(new SvelteMap<string, TagResponseDto>());
  #assetTagIds = $state(new SvelteMap<string, string[]>());

  #loadedAt = 0;
  #failedAt = 0;
  #pending: Promise<void> | undefined;

  status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');

  constructor() {
    eventManager.on({
      AssetsTag: (assetIds, change) => this.#patchAssetsTag(assetIds, change),
      TagCreate: (tag) => this.#tags.set(tag.id, tag),
      TagUpdate: (tag) => this.#updateTag(tag),
      TagDelete: (tag) => {
        if (tag.id) {
          this.#deleteTag(tag.id);
        }
      },
    });
  }

  tagIdsFor(assetId: string) {
    return this.#assetTagIds.get(assetId) ?? [];
  }

  hasTags(assetId: string) {
    return (this.#assetTagIds.get(assetId)?.length ?? 0) > 0;
  }

  tagsFor(assetId: string): TagResponseDto[] {
    const tags: TagResponseDto[] = [];
    for (const tagId of this.tagIdsFor(assetId)) {
      const tag = this.#tags.get(tagId);
      if (tag) {
        tags.push(tag);
      }
    }
    return tags;
  }

  ensureLoaded() {
    if (this.status === 'loading' || this.#pending) {
      return;
    }
    if (this.#loadedAt > 0 && Date.now() - this.#loadedAt <= CACHE_TTL_MS) {
      return;
    }
    if (this.#failedAt > 0 && Date.now() - this.#failedAt <= CACHE_TTL_MS) {
      return;
    }
    this.#pending = this.#load().finally(() => (this.#pending = undefined));
  }

  async #load() {
    this.status = 'loading';
    const startedAt = performance.now();
    try {
      const tags = await withRetry(() => getAllTags());
      this.#tags = new SvelteMap(tags.map((tag) => [tag.id, tag]));

      const assetTagIds = new SvelteMap<string, string[]>();
      await runPool(
        tags.map((tag) => tag.id),
        SEARCH_CONCURRENCY,
        (tagId) => this.#collectTag(tagId, assetTagIds),
      );

      for (const [assetId, tagIds] of assetTagIds) {
        assetTagIds.set(assetId, this.#sortTagIds(tagIds));
      }

      this.#assetTagIds = assetTagIds;
      this.#loadedAt = Date.now();
      this.status = 'ready';
      console.debug(
        `[idb] tag badge cache ready: ${assetTagIds.size} tagged assets / ${tags.length} tags in ${Math.round(performance.now() - startedAt)}ms`,
      );
    } catch (error) {
      this.#failedAt = Date.now();
      this.status = 'error';
      console.debug('[idb] tag badge cache failed', error);
    }
  }

  async #collectTag(tagId: string, target: SvelteMap<string, string[]>) {
    let page = 1;
    while (true) {
      let response;
      try {
        response = await withRetry(() =>
          searchAssets({ metadataSearchDto: { tagIds: [tagId], size: SEARCH_PAGE_SIZE, page } }),
        );
      } catch (error) {
        // One flaky tag must not abort the whole cache; the next TTL refresh retries it.
        console.debug(`[idb] tag badge cache: skipping tag ${tagId}`, error);
        return;
      }

      for (const asset of response.assets.items) {
        const tagIds = target.get(asset.id);
        if (tagIds) {
          tagIds.push(tagId);
        } else {
          target.set(asset.id, [tagId]);
        }
      }

      const nextPage = response.assets.nextPage;
      if (!nextPage || response.assets.items.length === 0) {
        return;
      }
      page = Number(nextPage);
    }
  }

  #patchAssetsTag(assetIds: string[], change?: AssetsTagChange) {
    if (!change) {
      return;
    }

    for (const assetId of assetIds) {
      const current = this.#assetTagIds.get(assetId) ?? [];
      const next =
        change.mode === 'add'
          ? [...new Set([...current, ...change.tagIds])]
          : current.filter((tagId) => !change.tagIds.includes(tagId));
      const sorted = this.#sortTagIds(next);
      if (sorted.length === 0) {
        this.#assetTagIds.delete(assetId);
      } else {
        this.#assetTagIds.set(assetId, sorted);
      }
    }
  }

  #updateTag(tag: TagResponseDto) {
    this.#tags.set(tag.id, tag);
    for (const [assetId, tagIds] of this.#assetTagIds) {
      if (tagIds.includes(tag.id)) {
        this.#assetTagIds.set(assetId, this.#sortTagIds(tagIds));
      }
    }
  }

  #deleteTag(tagId: string) {
    this.#tags.delete(tagId);
    for (const [assetId, tagIds] of this.#assetTagIds) {
      if (!tagIds.includes(tagId)) {
        continue;
      }
      const next = tagIds.filter((id) => id !== tagId);
      if (next.length === 0) {
        this.#assetTagIds.delete(assetId);
      } else {
        this.#assetTagIds.set(assetId, next);
      }
    }
  }

  #sortTagIds(tagIds: string[]) {
    return [...tagIds].sort((a, b) => {
      const aValue = this.#tags.get(a)?.value ?? '';
      const bValue = this.#tags.get(b)?.value ?? '';
      const aOrder = taxonomyOrder.get(aValue) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = taxonomyOrder.get(bValue) ?? Number.MAX_SAFE_INTEGER;
      return aOrder === bOrder ? aValue.localeCompare(bValue) : aOrder - bOrder;
    });
  }
}

export const tagBadgeManager = new TagBadgeManager();
