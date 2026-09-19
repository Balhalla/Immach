<script lang="ts">
  import SearchHistorySection from './SearchHistorySection.svelte';
  import { t } from 'svelte-i18n';
  import { fly } from 'svelte/transition';
  import { Button, Text } from '@immich/ui';
  import {
    mdiAccount,
    mdiCalendarBlank,
    mdiCalendarStar,
    mdiChevronDown,
    mdiChevronUp,
    mdiDomain,
    mdiImage,
    mdiMagnify,
    mdiMapMarker,
    mdiMusic,
    mdiTagMultiple,
    mdiTune,
  } from '@mdi/js';
  import SearchLocationSection from './SearchLocationSection.svelte';
  import { getAllTags, type PersonResponseDto, type TagResponseDto } from '@immich/sdk';
  import SearchMediaSection from './SearchMediaSection.svelte';
  import SearchCameraSection from './SearchCameraSection.svelte';
  import SearchDateSection from './SearchDateSection.svelte';
  import SearchPeopleSection from './SearchPeopleSection.svelte';
  import SearchTagsSection from './SearchTagsSection.svelte';
  import SearchTextSection from './SearchTextSection.svelte';
  import SearchDisplaySection from './SearchDisplaySection.svelte';
  import SearchRatingsSection from './SearchRatingsSection.svelte';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import {
    getPeople,
    getSearchDatePreset,
    getSearchDateTitle,
    getSearchMediaTitle,
    getSearchPeopleTitle,
    getSearchPlacesTitle,
    getSearchTagsTitle,
    getSearchTypeTitle,
  } from './search-bar-utils';
  import { onMount } from 'svelte';
  import { searchManager } from '$lib/managers/search-manager.svelte';
  import SearchButton from './SearchButton.svelte';
  import { TAG_CATEGORIES } from '$lib/utils/tag-taxonomy';

  interface Props {
    id: string;
    isOpen?: boolean;
    onSelectSearchTerm: (searchTerm: string) => void;
    onClearSearchTerm: (searchTerm: string) => void;
    onClearAllSearchTerms: () => void;
    onActiveSelectionChange: (selectedId: string | undefined) => void;
    onSearch: () => void;
  }

  let {
    id,
    isOpen = false,
    onSelectSearchTerm,
    onClearSearchTerm,
    onClearAllSearchTerms,
    onActiveSelectionChange,
    onSearch,
  }: Props = $props();

  // The dedicated tabs drive the picker scoped to a single taxonomy category; the
  // last tab covers every remaining category through the chip row.
  const TAG_TABS = [
    { name: 'photographer', category: 'Photographer', icon: mdiAccount },
    { name: 'organisation', category: 'Organisation', icon: mdiDomain },
    { name: 'edition', category: 'Edition', icon: mdiCalendarStar },
    { name: 'location', category: 'Location', icon: mdiMapMarker },
    { name: 'band', category: 'Band & Workshop', icon: mdiMusic },
  ];
  const DEDICATED_CATEGORIES = new Set(TAG_TABS.map((tab) => tab.category));
  const REMAINING_CATEGORIES = TAG_CATEGORIES.filter((category) => !DEDICATED_CATEGORIES.has(category.name)).map(
    (category) => category.name,
  );

  const tagTabs = [
    ...TAG_TABS.map((tab) => ({ name: tab.name, icon: tab.icon, title: tab.category })),
    { name: 'tags', icon: mdiTagMultiple, title: $t('tags') },
  ];

  let searchHistory = $state<SearchHistorySection>();

  let activeFilter = $state('edition');
  let advancedFilter = $state<string | undefined>('type');
  let showAdvanced = $state(false);
  let peoplePromise = $state<Promise<PersonResponseDto[]>>();
  let people = $state<PersonResponseDto[]>();
  let tagsPromise = $state<Promise<TagResponseDto[]>>();
  let tags = $state<TagResponseDto[]>();

  let typeTitle = $derived(getSearchTypeTitle(searchManager.filter.queryType));
  let peopleTitle = $state<string>();
  let dateTitle = $derived(
    getSearchDateTitle(
      getSearchDatePreset(searchManager.filter.date.takenAfter, searchManager.filter.date.takenBefore),
      searchManager.filter.date.takenAfter,
      searchManager.filter.date.takenBefore,
    ),
  );
  let placesTitle = $derived(
    getSearchPlacesTitle(
      searchManager.filter.location.city,
      searchManager.filter.location.state,
      searchManager.filter.location.country,
    ),
  );
  let tagsTitle = $state<string>();
  let mediaTitle = $derived(getSearchMediaTitle(searchManager.filter.mediaType));

  const advancedFilters = [
    {
      name: 'type',
      icon: mdiMagnify,
      title: $t('search_type'),
      activeTitle: () => typeTitle,
    },
    {
      name: 'people',
      icon: mdiAccount,
      title: $t('people'),
      activeTitle: () => peopleTitle,
    },
    {
      name: 'date',
      icon: mdiCalendarBlank,
      title: $t('date'),
      activeTitle: () => dateTitle,
    },
    {
      name: 'places',
      icon: mdiMapMarker,
      title: $t('places'),
      activeTitle: () => placesTitle,
    },
    {
      name: 'media',
      icon: mdiImage,
      title: $t('media'),
      activeTitle: () => mediaTitle,
    },
  ];

  const advancedFiltersSet = $derived(
    searchManager.filter.display.isArchive ||
      searchManager.filter.display.isFavorite ||
      searchManager.filter.display.isNotInAlbum ||
      searchManager.filter.rating,
  );

  const clear = () => {
    searchManager.reset();
    peopleTitle = tagsTitle = undefined;
  };

  onMount(() => {
    if (searchManager.filter.personIds.size > 0 && !peoplePromise) {
      peoplePromise = getPeople(searchManager.filter.personIds);
      void peoplePromise.then((res) => (people = res));
    }

    if (!tagsPromise) {
      tagsPromise = getAllTags();
      void tagsPromise.then((res) => (tags = res));
    }
  });

  $effect(() => {
    if (people) {
      peopleTitle = getSearchPeopleTitle(people, searchManager.filter.personIds);
    }
  });

  $effect(() => {
    if (tags && searchManager.filter.tagIds) {
      tagsTitle = getSearchTagsTitle(tags, searchManager.filter.tagIds);
    }
  });

  export function moveSelection(increment: 1 | -1) {
    if (searchHistory) {
      searchHistory.moveSelection(increment);
    }
  }

  export function clearSelection() {
    if (searchHistory) {
      searchHistory.clearSelection();
    }
  }

  export function selectActiveOption() {
    if (searchHistory) {
      searchHistory.selectActiveOption();
    }
  }
</script>

<div role="listbox" {id}>
  {#if isOpen}
    <div
      transition:fly={{ y: 25, duration: 250 }}
      class="absolute z-10 w-full rounded-b-3xl bg-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-all dark:bg-immich-dark-gray dark:text-gray-300"
    >
      <SearchHistorySection
        bind:this={searchHistory}
        {onSelectSearchTerm}
        {onClearSearchTerm}
        {onClearAllSearchTerms}
        {onActiveSelectionChange}
      />
      <div class="px-5">
        <Text class="py-5" fontWeight="medium" aria-hidden={true}>{$t('filter_by')}</Text>
        <div class="flex flex-wrap gap-2" data-tag-filter-tabs>
          {#each tagTabs as item (item.name)}
            <span class="contents" data-tag-filter-tab={item.name}>
              <SearchButton
                active={activeFilter === item.name}
                leadingIcon={item.icon}
                class={activeFilter === item.name ? 'border-2' : undefined}
                onclick={() => (activeFilter = item.name)}
              >
                {item.title}
              </SearchButton>
            </span>
          {/each}
        </div>
      </div>
      {#if activeFilter}
        <div class="px-5 pt-5">
          {#each TAG_TABS as tab (tab.name)}
            {#if activeFilter === tab.name}
              <SearchTagsSection
                bind:title={tagsTitle}
                parentPromise={tagsPromise}
                categoryNames={[tab.category]}
                defaultCategory={tab.category}
                showCategoryRow={false}
              />
            {/if}
          {/each}
          {#if activeFilter === 'tags'}
            <SearchTagsSection
              bind:title={tagsTitle}
              parentPromise={tagsPromise}
              categoryNames={REMAINING_CATEGORIES}
              defaultCategory={null}
            />
          {/if}
        </div>
      {/if}
      <div
        class="grid transition-[grid-template-rows] duration-200 ease-in-out {showAdvanced
          ? 'grid-rows-[1fr]'
          : 'grid-rows-[0fr]'}"
        inert={!showAdvanced}
      >
        <div class="overflow-hidden">
          <div class="my-5 h-px w-full bg-light-200 dark:bg-dark-600"></div>
          <div class="px-5">
            <div class="flex flex-wrap gap-2" data-advanced-filter-tabs>
              {#each advancedFilters as item (item.name)}
                <span class="contents" data-advanced-filter-tab={item.name}>
                  <SearchButton
                    active={advancedFilter === item.name || Boolean(item.activeTitle())}
                    leadingIcon={item.icon}
                    class={advancedFilter === item.name ? 'border-2' : undefined}
                    onclick={() => (advancedFilter = advancedFilter === item.name ? undefined : item.name)}
                  >
                    {item.activeTitle() ?? item.title}
                  </SearchButton>
                </span>
              {/each}
            </div>
            {#if advancedFilter === 'type'}
              <div class="pt-5">
                <SearchTextSection />
              </div>
            {:else if advancedFilter === 'people'}
              <div class="pt-5">
                <SearchPeopleSection bind:title={peopleTitle} parentPromise={peoplePromise} />
              </div>
            {:else if advancedFilter === 'date'}
              <div class="pt-5">
                <SearchDateSection />
              </div>
            {:else if advancedFilter === 'places'}
              <div class="pt-5">
                <SearchLocationSection />
              </div>
            {:else if advancedFilter === 'media'}
              <div class="pt-5">
                <SearchMediaSection />
              </div>
            {/if}
            <SearchCameraSection />
            {#if authManager.authenticated && authManager.preferences.ratings.enabled}
              <SearchRatingsSection />
            {/if}
            <SearchDisplaySection />
          </div>
        </div>
      </div>
      <div class="my-5 h-px w-full bg-light-200 dark:bg-dark-600"></div>
      <div class="flex gap-2 px-5 pb-5">
        <Button
          size="small"
          variant={advancedFiltersSet ? 'outline' : 'ghost'}
          leadingIcon={mdiTune}
          trailingIcon={showAdvanced ? mdiChevronUp : mdiChevronDown}
          onclick={() => (showAdvanced = !showAdvanced)}>{$t('advanced_filters')}</Button
        >
        <div class="flex-1"></div>
        <Button
          size="small"
          shape="round"
          variant="outline"
          color="secondary"
          class="bg-transparent"
          onclick={() => clear()}>{$t('clear_all')}</Button
        >
        <Button size="small" shape="round" onclick={() => onSearch()}>{$t('search')}</Button>
      </div>
    </div>
  {/if}
</div>
