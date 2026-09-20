<script lang="ts">
  import type { TagResponseDto } from '@immich/sdk';
  import { Button } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { SvelteSet } from 'svelte/reactivity';
  import type { TagMatchMode } from '$lib/types';
  import { categoryNameForTag, compareTagDisplayOrder, compareTagOrder, TAG_CATEGORIES } from '$lib/utils/tag-taxonomy';
  import TagPill from '../TagPill.svelte';

  interface Props {
    allTags: TagResponseDto[];
    selectedIds: SvelteSet<string>;
    defaultCategory?: string | null;
    categoryNames?: string[] | null;
    showCategoryRow?: boolean;
    selectedVariant?: 'primary' | 'danger';
    allowCreate?: boolean;
    showMatchMode?: boolean;
    matchMode?: TagMatchMode;
    maxHeightClass?: string;
    sortSelected?: boolean;
    onSelectionChange?: () => void;
    onAfterRemove?: () => void;
    onCreate?: (value: string) => void;
  }

  let {
    allTags,
    selectedIds,
    defaultCategory = null,
    categoryNames = null,
    showCategoryRow = true,
    selectedVariant = 'primary',
    allowCreate = false,
    showMatchMode = false,
    matchMode = $bindable<TagMatchMode>('all'),
    maxHeightClass = 'max-h-40',
    sortSelected = false,
    onSelectionChange,
    onAfterRemove,
    onCreate,
  }: Props = $props();

  const OTHER_CATEGORY = '__other__';
  const BAND_WORKSHOP_CATEGORY = 'Band & Workshop';
  const YEAR_SUFFIX = /_(\d{4})$/;
  const bandWorkshopKinds: Array<'band' | 'workshop'> = ['band', 'workshop'];
  const bandWorkshopKind = (value: string) => (value.startsWith('WORKSHOP_') ? 'workshop' : 'band');
  const tagYear = (value: string) => YEAR_SUFFIX.exec(value)?.[1] ?? null;
  const matchModes: TagMatchMode[] = ['all', 'any', 'none'];

  let tagMap = $derived(Object.fromEntries(allTags.map((tag) => [tag.id, tag])));
  let query = $state('');
  let selectedCategory = $state<string | null>(defaultCategory);
  let lastToggledIndex = $state(-1);
  let bandWorkshopFilterKind = $state<'band' | 'workshop'>('band');
  let bandWorkshopYearChoice = $state<string | null>(null);
  let trimmedQuery = $derived(query.trim());
  let queryActive = $derived(trimmedQuery.length > 0);
  let canCreate = $derived(
    allowCreate && queryActive && allTags.every((tag) => tag.value.toLowerCase() !== trimmedQuery.toLowerCase()),
  );
  let availableTags = $derived(
    categoryNames
      ? allTags.filter((tag) => {
          const name = categoryNameForTag(tag.value);
          return name !== undefined && categoryNames.includes(name);
        })
      : allTags,
  );
  let visibleCategories = $derived(
    categoryNames ? TAG_CATEGORIES.filter((category) => categoryNames.includes(category.name)) : TAG_CATEGORIES,
  );
  let uncategorizedTags = $derived(availableTags.filter((tag) => !categoryNameForTag(tag.value)));
  let visibleTags = $derived(
    queryActive || selectedCategory === null
      ? availableTags
      : selectedCategory === OTHER_CATEGORY
        ? uncategorizedTags
        : availableTags.filter((tag) => categoryNameForTag(tag.value) === selectedCategory),
  );
  let bandWorkshopActive = $derived(selectedCategory === BAND_WORKSHOP_CATEGORY);
  let bandWorkshopTags = $derived(
    availableTags.filter((tag) => categoryNameForTag(tag.value) === BAND_WORKSHOP_CATEGORY),
  );
  let bandWorkshopYears = $derived(
    [
      ...new Set(
        bandWorkshopTags
          .filter((tag) => bandWorkshopKind(tag.value) === bandWorkshopFilterKind)
          .map((tag) => tagYear(tag.value)),
      ),
    ]
      .filter((year): year is string => year !== null)
      .sort()
      .reverse(),
  );
  let bandWorkshopYear = $derived(
    bandWorkshopYearChoice === 'all'
      ? 'all'
      : bandWorkshopYearChoice && bandWorkshopYears.includes(bandWorkshopYearChoice)
        ? bandWorkshopYearChoice
        : (bandWorkshopYears[0] ?? 'all'),
  );
  let scopedTags = $derived(
    bandWorkshopActive
      ? visibleTags.filter(
          (tag) =>
            categoryNameForTag(tag.value) !== BAND_WORKSHOP_CATEGORY ||
            (bandWorkshopKind(tag.value) === bandWorkshopFilterKind &&
              (bandWorkshopYear === 'all' || tagYear(tag.value) === bandWorkshopYear)),
        )
      : visibleTags,
  );
  let filteredTags = $derived(
    [...scopedTags]
      .filter((tag) => tag.value.toLowerCase().includes(trimmedQuery.toLowerCase()))
      .sort((a, b) => compareTagOrder(a.value, b.value)),
  );
  let selectedTags = $derived.by(() => {
    const tags = [...selectedIds].map((tagId) => tagMap[tagId]).filter((tag): tag is TagResponseDto => Boolean(tag));
    return sortSelected ? tags.sort((a, b) => compareTagDisplayOrder(a.value, b.value)) : tags;
  });

  const notifyChange = () => onSelectionChange?.();

  const selectCategory = (name: string | null) => {
    selectedCategory = name;
    query = '';
    lastToggledIndex = -1;
  };

  const setBandWorkshopKind = (kind: 'band' | 'workshop') => {
    bandWorkshopFilterKind = kind;
    lastToggledIndex = -1;
  };

  const setBandWorkshopYear = (year: string) => {
    bandWorkshopYearChoice = year;
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
    notifyChange();
  };

  const handleCreate = () => {
    if (!canCreate) {
      return;
    }

    onCreate?.(trimmedQuery);
    query = '';
    lastToggledIndex = -1;
  };

  const handleRemove = (tagId: string) => {
    selectedIds.delete(tagId);
    lastToggledIndex = -1;
    notifyChange();
    onAfterRemove?.();
  };

  const handleClear = () => {
    selectedIds.clear();
    lastToggledIndex = -1;
    notifyChange();
    onAfterRemove?.();
  };

  const chipClass = (selected: boolean) =>
    `rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors ${
      selected
        ? `border-transparent text-white ${selectedVariant === 'danger' ? 'bg-danger' : 'bg-primary'}`
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

  const matchModeClass = (active: boolean) =>
    `flex-1 rounded-md px-2 py-0.5 text-xs whitespace-nowrap transition-colors ${
      active ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;

  const bandWorkshopKindClass = (active: boolean) =>
    `rounded-md px-3 py-0.5 text-xs whitespace-nowrap transition-colors ${
      active ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;
</script>

<section class="flex flex-col gap-2">
  {#if showMatchMode}
    <div class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="group" aria-label={$t('idb_tag_match')}>
      {#each matchModes as mode (mode)}
        <button
          type="button"
          class={matchModeClass(matchMode === mode)}
          aria-pressed={matchMode === mode}
          data-tag-match={mode}
          onclick={() => {
            matchMode = mode;
            notifyChange();
          }}
        >
          {$t(`idb_match_${mode}`)}
        </button>
      {/each}
    </div>
  {/if}

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
      <Button size="tiny" variant="ghost" color="secondary" onclick={handleClear} data-tag-chips-clear>
        {$t('clear')}
      </Button>
    {/if}
  </div>

  {#if showCategoryRow}
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
      {#each visibleCategories as category (category.name)}
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
  {/if}

  {#if bandWorkshopActive && bandWorkshopTags.length > 0}
    <div class="flex flex-wrap items-center gap-2" data-tag-bw-filters>
      <div class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="group" aria-label="Band & Workshop">
        {#each bandWorkshopKinds as kind (kind)}
          <button
            type="button"
            class={bandWorkshopKindClass(bandWorkshopFilterKind === kind)}
            aria-pressed={bandWorkshopFilterKind === kind}
            data-tag-bw-kind={kind}
            onclick={() => setBandWorkshopKind(kind)}
          >
            {kind === 'band' ? $t('idb_bands') : $t('idb_workshops')}
          </button>
        {/each}
      </div>
      {#if bandWorkshopYears.length > 0}
        <div class="flex gap-1" role="group" aria-label={$t('idb_all_years')}>
          <button
            type="button"
            class={allChipClass(bandWorkshopYear === 'all')}
            aria-pressed={bandWorkshopYear === 'all'}
            data-tag-bw-year="all"
            onclick={() => setBandWorkshopYear('all')}
          >
            {$t('idb_all_years')}
          </button>
          {#each bandWorkshopYears as year (year)}
            <button
              type="button"
              class={allChipClass(bandWorkshopYear === year)}
              aria-pressed={bandWorkshopYear === year}
              data-tag-bw-year={year}
              onclick={() => setBandWorkshopYear(year)}
            >
              {year}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex {maxHeightClass} flex-wrap content-start gap-1 overflow-y-auto" data-tag-chip-picker>
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
    {#if filteredTags.length === 0 && !queryActive && allTags.length > 0}
      <p class="text-xs text-gray-400 dark:text-gray-500" data-tag-picker-empty>{$t('idb_no_tags_in_category')}</p>
    {/if}
  </div>
</section>

{#if selectedIds.size > 0}
  <section class="flex flex-wrap gap-1 py-2" data-tag-staged>
    {#each selectedTags as tag (tag.id)}
      <div data-tag-selected={tag.value}>
        <TagPill label={tag.value} onRemove={() => handleRemove(tag.id)} />
      </div>
    {/each}
  </section>
{/if}
