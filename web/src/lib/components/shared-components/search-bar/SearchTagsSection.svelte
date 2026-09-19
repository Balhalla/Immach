<script lang="ts">
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { searchManager } from '$lib/managers/search-manager.svelte';
  import { getAllTags, type TagResponseDto } from '@immich/sdk';
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import TagChipPicker from '$lib/components/shared-components/tag-picker/TagChipPicker.svelte';
  import { getSearchTagsTitle } from './search-bar-utils';

  interface Props {
    title: string | undefined;
    parentPromise: Promise<TagResponseDto[]> | undefined;
    categoryNames?: string[] | null;
    defaultCategory?: string | null;
    showCategoryRow?: boolean;
  }

  let {
    // eslint-disable-next-line no-useless-assignment
    title = $bindable(),
    parentPromise,
    categoryNames = null,
    defaultCategory = 'Edition',
    showCategoryRow = true,
  }: Props = $props();

  let container = $state<HTMLDivElement>();
  let allTags: TagResponseDto[] = $state([]);
  const fallbackTagIds = new SvelteSet<string>();
  let selectedIds = $derived<SvelteSet<string>>(searchManager.filter.tagIds ?? fallbackTagIds);

  onMount(() => {
    if (parentPromise) {
      void parentPromise.then((res) => (allTags = res));
    } else {
      void getAllTags().then((res) => (allTags = res));
    }
  });

  // `null` means untagged (only settable through a bookmark today); picking a tag
  // turns it into a regular selection instead of dropping the null filter.
  const commitSelection = () => {
    if (searchManager.filter.tagIds === null) {
      searchManager.filter.tagIds = new SvelteSet(fallbackTagIds);
    }

    title = getSearchTagsTitle(allTags, selectedIds);
  };

  // Move focus back to the container so it doesn't fallback to the body and close the search bar
  const handleAfterRemove = () => container?.focus();
</script>

{#if authManager.authenticated && authManager.preferences.tags.enabled}
  <div id="location-selection" bind:this={container} tabindex="-1">
    <TagChipPicker
      {allTags}
      {selectedIds}
      {defaultCategory}
      {categoryNames}
      {showCategoryRow}
      showMatchMode
      sortSelected
      maxHeightClass="max-h-48"
      bind:matchMode={searchManager.filter.tagMatch}
      onSelectionChange={commitSelection}
      onAfterRemove={handleAfterRemove}
    />
  </div>
{/if}
