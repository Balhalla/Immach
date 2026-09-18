<script lang="ts">
  import TagChipPicker from './TagChipPicker.svelte';
  import { getAllTags, type TagResponseDto } from '@immich/sdk';
  import { Button } from '@immich/ui';
  import { mdiMagnify } from '@mdi/js';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';
  import type { TagMatchMode } from '$lib/types';

  interface Props {
    initialTagIds: string[];
    initialMatchMode: TagMatchMode;
    anchorStyle?: string;
    onApply: (tagIds: string[], matchMode: TagMatchMode) => void;
    onClose: () => void;
  }

  let { initialTagIds, initialMatchMode, anchorStyle = '', onApply, onClose }: Props = $props();

  let selectedIds = new SvelteSet(initialTagIds);
  let matchMode = $state<TagMatchMode>(initialMatchMode);
  let allTags: TagResponseDto[] = $state([]);
  let isMobile = $derived(mediaQueryManager.pointerCoarse);
  let applyDisabled = $derived(selectedIds.size === 0 && initialTagIds.length === 0);

  onMount(async () => {
    allTags = await getAllTags();
  });

  const handleApply = () => {
    if (applyDisabled) {
      return;
    }

    onApply([...selectedIds], matchMode);
  };
</script>

{#if isMobile}
  <div
    class="fixed inset-0 z-50 bg-black/50"
    transition:fly={{ duration: 150 }}
    aria-hidden="true"
    onclick={onClose}
  ></div>
  <div
    class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t bg-immich-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-immich-dark-gray dark:text-immich-dark-fg"
    role="dialog"
    aria-label={$t('idb_filter_by_tags')}
    transition:fly={{ y: '100%', duration: 200 }}
  >
    <p class="text-sm font-medium">{$t('idb_filter_by_tags')}</p>
    <TagChipPicker
      {allTags}
      {selectedIds}
      bind:matchMode
      defaultCategory="Edition"
      showMatchMode
      sortSelected
      maxHeightClass="max-h-64"
    />
    <div class="flex justify-end gap-2">
      <Button size="small" variant="ghost" color="secondary" onclick={onClose} data-tag-filter-cancel
        >{$t('cancel')}</Button
      >
      <Button size="small" leadingIcon={mdiMagnify} disabled={applyDisabled} onclick={handleApply} data-tag-filter-apply
        >{$t('search')}</Button
      >
    </div>
  </div>
{:else}
  <div
    class="fixed z-50 flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-xl border border-gray-200 bg-immich-bg p-3 shadow-lg dark:border-gray-700 dark:bg-immich-dark-gray dark:text-immich-dark-fg"
    style={anchorStyle}
    role="dialog"
    aria-label={$t('idb_filter_by_tags')}
    transition:fly={{ y: -8, duration: 150 }}
  >
    <TagChipPicker
      {allTags}
      {selectedIds}
      bind:matchMode
      defaultCategory="Edition"
      showMatchMode
      sortSelected
      maxHeightClass="max-h-64"
    />
    <div class="flex justify-end gap-2">
      <Button size="small" variant="ghost" color="secondary" onclick={onClose} data-tag-filter-cancel
        >{$t('cancel')}</Button
      >
      <Button size="small" leadingIcon={mdiMagnify} disabled={applyDisabled} onclick={handleApply} data-tag-filter-apply
        >{$t('search')}</Button
      >
    </div>
  </div>
{/if}
