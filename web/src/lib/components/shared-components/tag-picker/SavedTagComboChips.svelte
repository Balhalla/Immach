<script lang="ts">
  import { savedTagCombos, type SavedTagCombo } from '$lib/stores/saved-tag-combos.store';
  import { t } from 'svelte-i18n';

  interface Props {
    size?: 'small' | 'medium' | 'large';
    onApply: (combo: SavedTagCombo) => void;
  }

  let { size = 'medium', onApply }: Props = $props();

  const chipClass = (size: 'small' | 'medium' | 'large') =>
    `shrink-0 rounded-full border border-gray-300 bg-transparent px-2 text-xs whitespace-nowrap transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 ${
      size === 'small' ? 'py-px' : 'py-0.5'
    }`;
</script>

{#if $savedTagCombos.combos.length > 0}
  <div class="flex min-w-0 scrollbar-hidden items-center gap-1 overflow-x-auto" data-saved-combo-row>
    {#each $savedTagCombos.combos as combo (combo.id)}
      <button
        type="button"
        class={chipClass(size)}
        onclick={() => onApply(combo)}
        title={$t('idb_apply_tag_combo')}
        data-saved-combo-chip={combo.name}
      >
        {combo.name}
      </button>
    {/each}
  </div>
{/if}
