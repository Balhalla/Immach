<script lang="ts">
  import { clickOutside } from '$lib/actions/click-outside';
  import { authManager } from '$lib/managers/auth-manager.svelte';
  import { searchManager } from '$lib/managers/search-manager.svelte';
  import type { TagMatchMode } from '$lib/types';
  import { IconButton } from '@immich/ui';
  import { mdiTagMultiple } from '@mdi/js';
  import { SvelteSet } from 'svelte/reactivity';
  import { t } from 'svelte-i18n';
  import TagFilterPopover from './TagFilterPopover.svelte';

  interface Props {
    // merge: keep the rest of the current filter (Search page edits the existing selection)
    // replace: start a fresh filter that only contains the picked tags (timeline shortcuts)
    mode?: 'merge' | 'replace';
    size?: 'small' | 'medium' | 'large';
  }

  let { mode = 'replace', size = 'medium' }: Props = $props();

  let isOpen = $state(false);
  let anchorStyle = $state('');

  let currentTagIds = $derived(searchManager.filter.tagIds === null ? [] : [...(searchManager.filter.tagIds ?? [])]);

  const close = () => {
    isOpen = false;
  };

  const toggle = (event: MouseEvent) => {
    if (isOpen) {
      close();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      anchorStyle = `top:${Math.round(rect.bottom + 8)}px; inset-inline-end:${Math.round(window.innerWidth - rect.right)}px;`;
    }
    isOpen = true;
  };

  const applyFilter = (tagIds: string[], tagMatch: TagMatchMode) => {
    close();

    if (mode === 'replace') {
      searchManager.reset();
    }

    searchManager.filter.tagIds = new SvelteSet(tagIds);
    searchManager.filter.tagMatch = tagMatch;
    void searchManager.submit();
  };
</script>

{#if authManager.authenticated && authManager.preferences.tags.enabled}
  <div class="relative" use:clickOutside={{ onOutclick: close, onEscape: close }}>
    <IconButton
      shape="round"
      color="secondary"
      variant="ghost"
      aria-label={$t('idb_filter_by_tags')}
      icon={mdiTagMultiple}
      {size}
      onclick={toggle}
      data-tag-filter-button
    />
    {#if isOpen}
      <TagFilterPopover
        initialTagIds={currentTagIds}
        initialMatchMode={searchManager.filter.tagMatch}
        {anchorStyle}
        onApply={applyFilter}
        onClose={close}
      />
    {/if}
  </div>
{/if}
