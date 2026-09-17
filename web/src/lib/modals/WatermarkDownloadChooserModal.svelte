<script lang="ts">
  import { Button, Modal, ModalBody } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    onClose: (choice?: 'clean' | 'watermark') => void;
  };

  let { onClose }: Props = $props();

  let cleanOption = $state<HTMLElement | null>(null);

  $effect(() => {
    cleanOption?.focus();
  });
</script>

<Modal size="tiny" title={$t('download_original')} icon={mdiDownload} onClose={() => onClose()}>
  <ModalBody>
    <div class="flex flex-col gap-2">
      <Button
        bind:ref={cleanOption}
        variant="filled"
        color="primary"
        fullWidth
        data-idb-download-clean
        onclick={() => onClose('clean')}
      >
        {$t('idb_download_without_watermark')}
      </Button>
      <Button
        variant="ghost"
        color="secondary"
        fullWidth
        data-idb-download-watermark
        onclick={() => onClose('watermark')}
      >
        {$t('idb_download_with_watermark')}
      </Button>
    </div>
  </ModalBody>
</Modal>
