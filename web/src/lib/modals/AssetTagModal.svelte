<script lang="ts">
  import { eventManager } from '$lib/managers/event-manager.svelte';
  import { removeTag, tagAssets } from '$lib/utils/asset-utils';
  import { getAllTags, upsertTags, type TagResponseDto } from '@immich/sdk';
  import { Button, FormModal } from '@immich/ui';
  import { mdiTag } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';
  import TagChipPicker from '../components/shared-components/tag-picker/TagChipPicker.svelte';

  interface Props {
    onClose: (updated?: boolean) => void;
    assetIds: string[];
  }

  let { onClose, assetIds }: Props = $props();

  let allTags: TagResponseDto[] = $state([]);
  let selectedIds = new SvelteSet<string>();
  let mode: 'add' | 'remove' = $state('add');
  let disabled = $derived(selectedIds.size === 0);

  onMount(async () => {
    allTags = await getAllTags();
  });

  const setMode = (next: 'add' | 'remove') => {
    if (mode === next) {
      return;
    }

    mode = next;
    selectedIds.clear();
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

  const handleCreate = async (value: string) => {
    const [newTag] = await upsertTags({ tagUpsertDto: { tags: [value] } });
    allTags.push(newTag);
    selectedIds.add(newTag.id);
  };
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

    <TagChipPicker
      {allTags}
      {selectedIds}
      allowCreate
      selectedVariant={mode === 'add' ? 'primary' : 'danger'}
      onCreate={handleCreate}
    />
  </div>
</FormModal>
