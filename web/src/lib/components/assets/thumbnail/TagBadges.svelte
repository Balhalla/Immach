<script lang="ts">
  import { tagBadgeManager } from '$lib/managers/tag-badge-manager.svelte';
  import { showTagBadges } from '$lib/stores/preferences.store';

  interface Props {
    assetId: string;
    maxVisible?: number;
  }

  let { assetId, maxVisible = 3 }: Props = $props();

  const tags = $derived(tagBadgeManager.tagsFor(assetId));
  const visibleTags = $derived(tags.slice(0, maxVisible));
  const hiddenCount = $derived(tags.length - visibleTags.length);
  const hiddenTitle = $derived(tags.map((tag) => tag.value).join(', '));
</script>

{#if $showTagBadges && visibleTags.length > 0}
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-2 flex items-center gap-0.5 overflow-hidden bg-linear-to-t from-black/60 to-transparent px-1 pt-3 pb-0.5"
    data-tag-badges
    aria-hidden="true"
  >
    {#each visibleTags as tag (tag.id)}
      <span
        class="max-w-24 shrink-0 truncate rounded-sm px-1 py-px text-[10px]/3 font-medium text-white"
        style:background-color={tag.color ?? '#6b7280'}
        title={tag.value}
        data-tag-badge={tag.value}
      >
        {tag.value}
      </span>
    {/each}
    {#if hiddenCount > 0}
      <span
        class="shrink-0 rounded-sm bg-black/70 px-1 py-px text-[10px]/3 font-medium text-white"
        title={hiddenTitle}
        data-tag-badge-count
      >
        +{hiddenCount}
      </span>
    {/if}
  </div>
{/if}
