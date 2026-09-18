<script lang="ts">
  import TagChipPicker from './TagChipPicker.svelte';
  import { getAllTags, type TagResponseDto } from '@immich/sdk';
  import { Button, Icon } from '@immich/ui';
  import { mdiDeleteOutline, mdiMagnify } from '@mdi/js';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import { deleteTagCombo, saveTagCombo, savedTagCombos, type SavedTagCombo } from '$lib/stores/saved-tag-combos.store';
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
  let comboName = $state('');
  let isMobile = $derived(mediaQueryManager.pointerCoarse);
  let applyDisabled = $derived(selectedIds.size === 0 && initialTagIds.length === 0);
  let canSaveCombo = $derived(selectedIds.size > 0 && comboName.trim().length > 0);

  onMount(async () => {
    allTags = await getAllTags();
  });

  const handleApply = () => {
    if (applyDisabled) {
      return;
    }

    onApply([...selectedIds], matchMode);
  };

  const handleApplyCombo = (combo: SavedTagCombo) => {
    onApply(combo.tagIds, combo.match);
  };

  const handleSaveCombo = () => {
    if (!canSaveCombo) {
      return;
    }

    saveTagCombo(comboName, [...selectedIds], matchMode);
    comboName = '';
  };
</script>

{#snippet content()}
  <TagChipPicker
    {allTags}
    {selectedIds}
    bind:matchMode
    defaultCategory="Edition"
    showMatchMode
    sortSelected
    maxHeightClass="max-h-64"
  />
  <section class="flex items-end gap-2" data-tag-combo-save>
    <input
      bind:value={comboName}
      placeholder={$t('idb_save_tag_combo_name')}
      aria-label={$t('idb_save_tag_combo_name')}
      class="immich-form-input w-full text-sm"
      data-tag-combo-name
    />
    <Button
      size="small"
      variant="ghost"
      color="secondary"
      disabled={!canSaveCombo}
      onclick={handleSaveCombo}
      data-tag-combo-save-button
    >
      {$t('idb_save_tag_combo')}
    </Button>
  </section>
  {#if $savedTagCombos.combos.length > 0}
    <section class="flex flex-col gap-1" data-tag-combos>
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{$t('idb_saved_tag_combos')}</p>
      {#each $savedTagCombos.combos as combo (combo.id)}
        <div class="flex items-center gap-1" data-saved-combo={combo.name}>
          <button
            type="button"
            class="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-start text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title={$t('idb_apply_tag_combo')}
            onclick={() => handleApplyCombo(combo)}
            data-saved-combo-apply={combo.name}
          >
            {combo.name}
          </button>
          <button
            type="button"
            class="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-danger dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label={$t('idb_delete_tag_combo')}
            title={$t('idb_delete_tag_combo')}
            onclick={() => deleteTagCombo(combo.id)}
            data-saved-combo-delete={combo.name}
          >
            <Icon icon={mdiDeleteOutline} size="16" />
          </button>
        </div>
      {/each}
    </section>
  {:else}
    <p class="text-xs text-gray-400 dark:text-gray-500" data-tag-combos-empty>{$t('idb_saved_tag_combos_empty')}</p>
  {/if}
{/snippet}

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
    {@render content()}
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
    {@render content()}
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
