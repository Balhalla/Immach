<script lang="ts">
  import Portal from '$lib/elements/Portal.svelte';
  import { tagBadgeManager } from '$lib/managers/tag-badge-manager.svelte';
  import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';
  import { showTagBadges } from '$lib/stores/preferences.store';
  import { categoryColorForTag } from '$lib/utils/tag-taxonomy';
  import { t } from 'svelte-i18n';

  interface Props {
    assetId: string;
    maxVisible?: number;
  }

  let { assetId, maxVisible = 3 }: Props = $props();

  const tags = $derived(tagBadgeManager.tagsFor(assetId));
  const visibleTags = $derived(tags.slice(0, maxVisible));
  const hiddenCount = $derived(tags.length - visibleTags.length);
  const isCoarsePointer = $derived(mediaQueryManager.pointerCoarse);

  let isOpen = $state(false);
  let anchorStyle = $state('');
  let badgeRow = $state<HTMLElement>();
  let popover = $state<HTMLElement>();
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = undefined;
    closeTimer = undefined;
  };

  const open = () => {
    clearTimers();
    if (badgeRow) {
      const rect = badgeRow.getBoundingClientRect();
      anchorStyle = `bottom:${Math.round(window.innerHeight - rect.top + 6)}px; inset-inline-end:${Math.round(window.innerWidth - rect.right)}px;`;
    }
    isOpen = true;
  };

  const close = () => {
    clearTimers();
    isOpen = false;
  };

  const scheduleOpen = () => {
    if (isCoarsePointer || isOpen) {
      return;
    }
    clearTimers();
    openTimer = setTimeout(open, 120);
  };

  const scheduleClose = () => {
    if (isCoarsePointer) {
      return;
    }
    clearTimers();
    closeTimer = setTimeout(close, 200);
  };

  // Documented compromise: on touch screens the badge strip toggles the full tag
  // list instead of opening the thumbnail; the rest of the thumbnail keeps its
  // normal tap behavior. On fine pointers clicks still bubble to the thumbnail.
  const handleClick = (event: MouseEvent) => {
    if (!isCoarsePointer) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  $effect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null || badgeRow?.contains(target) || popover?.contains(target)) {
        return;
      }
      close();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.stopPropagation();
      close();
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    addEventListener('keydown', handleEscape, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      removeEventListener('keydown', handleEscape, { capture: true });
    };
  });
</script>

{#if $showTagBadges && visibleTags.length > 0}
  <div
    class="pointer-events-auto absolute inset-x-0 bottom-0 z-3 flex items-center gap-0.5 overflow-hidden bg-linear-to-t from-black/60 to-transparent px-1 pt-3 pb-0.5"
    data-tag-badges
    role="button"
    tabindex="0"
    aria-label={$t('idb_all_tags')}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    bind:this={badgeRow}
    onclick={handleClick}
    onkeydown={handleKeydown}
    onmouseenter={scheduleOpen}
    onmouseleave={scheduleClose}
  >
    {#each visibleTags as tag (tag.id)}
      <span
        class="max-w-24 shrink-0 truncate rounded-sm px-1 py-px text-[10px]/3 font-medium text-white"
        style:background-color={tag.color ?? '#6b7280'}
        data-tag-badge={tag.value}
      >
        {tag.value}
      </span>
    {/each}
    {#if hiddenCount > 0}
      <span
        class="shrink-0 rounded-sm bg-black/70 px-1 py-px text-[10px]/3 font-medium text-white"
        data-tag-badge-count
      >
        +{hiddenCount}
      </span>
    {/if}
  </div>
{/if}

{#if isOpen}
  <Portal target="body">
    <div
      class="fixed z-50 flex max-h-64 w-60 max-w-[calc(100vw-1rem)] flex-col items-start gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-immich-bg p-2 shadow-lg dark:border-gray-700 dark:bg-immich-dark-gray dark:text-immich-dark-fg"
      style={anchorStyle}
      role="dialog"
      aria-label={$t('idb_all_tags')}
      tabindex="-1"
      data-tag-badge-popover
      bind:this={popover}
      onmouseenter={clearTimers}
      onmouseleave={scheduleClose}
    >
      {#each tags as tag (tag.id)}
        <span
          class="max-w-full truncate rounded-sm px-1.5 py-0.5 text-xs font-medium text-white"
          style:background-color={categoryColorForTag(tag.value) ?? tag.color ?? '#6b7280'}
          data-tag-badge-popover-item={tag.value}
        >
          {tag.value}
        </span>
      {/each}
    </div>
  </Portal>
{/if}
