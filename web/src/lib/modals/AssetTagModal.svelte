<script lang="ts">
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { removeTag, tagAssets } from '$lib/utils/asset-utils';
  import { categoryNameForTag, compareTagOrder, TAG_CATEGORIES } from '$lib/utils/tag-taxonomy';
  import { getAllTags, upsertTags, type TagResponseDto } from '@immich/sdk';
  import { Button, FormModal } from '@immich/ui';
  import { mdiTag } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import TagPill from '../components/shared-components/TagPill.svelte';

  interface Props {
    onClose: (updated?: boolean) => void;
    assetIds: string[];
  }

  let { onClose, assetIds }: Props = $props();

  const OTHER_CATEGORY = '__other__';
  let allTags: TagResponseDto[] = $state([]);
  let tagMap = $derived(Object.fromEntries(allTags.map((tag) => [tag.id, tag])));
  let selectedIds = new SvelteSet<string>();
  let mode: 'add' | 'remove' = $state('add');
  let query = $state('');
  let selectedCategory = $state<string | null>(null);
  let lastToggledIndex = $state(-1);
  let disabled = $derived(selectedIds.size === 0);
  let allowCreate = $derived(mode === 'add');
  let trimmedQuery = $derived(query.trim());
  let queryActive = $derived(trimmedQuery.length > 0);
  let canCreate = $derived(
    allowCreate && queryActive && !allTags.some((tag) => tag.value.toLowerCase() === trimmedQuery.toLowerCase()),
  );
  let uncategorizedTags = $derived(allTags.filter((tag) => !categoryNameForTag(tag.value)));
  let visibleTags = $derived(
    queryActive || selectedCategory === null
      ? allTags
      : selectedCategory === OTHER_CATEGORY
        ? uncategorizedTags
        : allTags.filter((tag) => categoryNameForTag(tag.value) === selectedCategory),
  );
  let filteredTags = $derived(
    [...visibleTags]
      .filter((tag) => tag.value.toLowerCase().includes(trimmedQuery.toLowerCase()))
      .sort((a, b) => compareTagOrder(a.value, b.value)),
  );

  onMount(async () => {
    allTags = await getAllTags();
  });

  const setMode = (next: 'add' | 'remove') => {
    if (mode === next) {
      return;
    }

    mode = next;
    selectedIds.clear();
    lastToggledIndex = -1;
  };

  const onSubmit = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    const tagIds = [...selectedIds];
    const updatedIds =
      mode === 'add'
        ? await tagAssets({ tagIds, assetIds, showNotification: false })
        : await removeTag({ tagIds, assetIds, showNotification: false });
    eventManager.emit('AssetsTag', updatedIds, { tagIds, mode });
    onClose(true);
  };

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }

    const [newTag] = await upsertTags({ tagUpsertDto: { tags: [trimmedQuery] } });
    allTags.push(newTag);
    selectedIds.add(newTag.id);
    query = '';
    lastToggledIndex = -1;
  };

  const handleRemove = (tag: string) => {
    selectedIds.delete(tag);
  };

  const selectCategory = (name: string | null) => {
    selectedCategory = name;
    query = '';
    lastToggledIndex = -1;
  };

  const toggleTag = (tag: TagResponseDto, event: MouseEvent) => {
    const index = filteredTags.indexOf(tag);
    const select = !selectedIds.has(tag.id);

    if (event.shiftKey && lastToggledIndex >= 0 && lastToggledIndex < filteredTags.length) {
      const from = Math.min(lastToggledIndex, index);
      const to = Math.max(lastToggledIndex, index);
      for (let i = from; i <= to; i++) {
        if (select) {
          selectedIds.add(filteredTags[i].id);
        } else {
          selectedIds.delete(filteredTags[i].id);
        }
      }
    } else if (select) {
      selectedIds.add(tag.id);
    } else {
      selectedIds.delete(tag.id);
    }

    lastToggledIndex = index;
  };

  const chipClass = (selected: boolean) =>
    `rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors ${
      selected
        ? mode === 'add'
          ? 'border-transparent bg-primary text-white'
          : 'border-transparent bg-danger text-white'
        : 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
    }`;

  const categoryChipClass = (active: boolean) =>
    `flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors ${
      active
        ? 'border-transparent text-white'
        : 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
    }`;

  const allChipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors ${
      active
        ? 'border-transparent bg-primary text-white'
        : 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
    }`;

  const otherChipClass = (active: boolean) => `${categoryChipClass(active)} ${active ? 'bg-gray-500' : ''}`;
</script>

<FormModal
  size="small"
  title={mode === 'add' ? $t('tag_assets') : $t('remove_tags')}
  icon={mdiTag}
  {onClose}
  {onSubmit}
  submitText={mode === 'add' ? $t('tag_assets') : $t('remove_tags')}
  submitColor={mode === 'add' ? 'primary' : 'danger'}
  onOpenAutoFocus={(event) => event.preventDefault()}
  {disabled}
>
  <div class="my-4 flex flex-col gap-3">
    <div class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="group" aria-label={$t('tags')}>
      <Button
        class="flex-1"
        size="tiny"
        variant={mode === 'add' ? 'filled' : 'ghost'}
        color="primary"
        aria-pressed={mode === 'add'}
        data-mode="add"
        onclick={() => setMode('add')}
      >
        {$t('add')}
      </Button>
      <Button
        class="flex-1"
        size="tiny"
        variant={mode === 'remove' ? 'filled' : 'ghost'}
        color="danger"
        aria-pressed={mode === 'remove'}
        data-mode="remove"
        onclick={() => setMode('remove')}
      >
        {$t('remove')}
      </Button>
    </div>

    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <input
          bind:value={query}
          oninput={() => (lastToggledIndex = -1)}
          placeholder={$t('search_tags')}
          aria-label={$t('search_tags')}
          class="immich-form-input w-full text-sm"
          data-tag-chip-search
        />
        {#if selectedIds.size > 0}
          <Button
            size="tiny"
            variant="ghost"
            color="secondary"
            onclick={() => selectedIds.clear()}
            data-tag-chips-clear
          >
            {$t('clear')}
          </Button>
        {/if}
      </div>
      <div
        class="flex gap-1 overflow-x-auto pb-1 transition-opacity {queryActive ? 'opacity-50' : ''}"
        role="group"
        aria-label={$t('category')}
        data-tag-category-row
      >
        <button
          type="button"
          class={allChipClass(selectedCategory === null)}
          aria-pressed={selectedCategory === null}
          data-tag-category="all"
          onclick={() => selectCategory(null)}
        >
          {$t('all')}
        </button>
        {#each TAG_CATEGORIES as category (category.name)}
          {@const active = selectedCategory === category.name}
          <button
            type="button"
            class={categoryChipClass(active)}
            style={active ? `background-color: ${category.color}` : undefined}
            aria-pressed={active}
            data-tag-category={category.name}
            onclick={() => selectCategory(category.name)}
          >
            <span class="size-2 shrink-0 rounded-full" style="background-color: {active ? '#fff' : category.color}"
            ></span>
            {category.name}
          </button>
        {/each}
        {#if uncategorizedTags.length > 0}
          <button
            type="button"
            class={otherChipClass(selectedCategory === OTHER_CATEGORY)}
            aria-pressed={selectedCategory === OTHER_CATEGORY}
            data-tag-category="other"
            onclick={() => selectCategory(OTHER_CATEGORY)}
          >
            {$t('other')}
          </button>
        {/if}
      </div>
      <div class="flex max-h-40 flex-wrap content-start gap-1 overflow-y-auto" data-tag-chip-picker>
        {#if canCreate}
          <button
            type="button"
            class="rounded-full border border-dashed border-primary px-2 py-0.5 text-xs whitespace-nowrap text-primary transition-colors hover:bg-primary/10"
            onclick={handleCreate}
            data-tag-create
          >
            {$t('create_tag')}: {trimmedQuery}
          </button>
        {/if}
        {#each filteredTags as tag (tag.id)}
          {@const selected = selectedIds.has(tag.id)}
          <button
            type="button"
            class={chipClass(selected)}
            aria-pressed={selected}
            data-tag-chip={tag.value}
            onclick={(event) => toggleTag(tag, event)}
          >
            {tag.value}
          </button>
        {/each}
      </div>
    </section>
  </div>

  {#if selectedIds.size > 0}
    <section class="flex flex-wrap gap-1 pb-2" data-tag-staged>
      {#each [...selectedIds] as tagId (tagId)}
        {@const tag = tagMap[tagId]}
        {#if tag}
          <TagPill label={tag.value} onRemove={() => handleRemove(tagId)} />
        {/if}
      {/each}
    </section>
  {/if}
</FormModal>
