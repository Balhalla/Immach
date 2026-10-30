<script lang="ts">
  import {
    Button,
    Checkbox,
    Input,
    Label,
    LoadingSpinner,
    Modal,
    ModalBody,
    ModalFooter,
    toastManager,
  } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { lang } from '$lib/stores/preferences.store';
  import type { TagSearchDto } from '$lib/types';
  import { handleError } from '$lib/utils/handle-error';
  import {
    buildOriginalsPlan,
    collectMatchingAssets,
    downloadOriginalsPlan,
    expandDownloadDriveIds,
    fetchSocialHelperHealth,
    getSocialResizeRun,
    IDB_ORIGINALS_SOCIAL_MAX_DIMENSION,
    originalsFetchCommand,
    originalsPlanFileName,
    startBrowserDownloads,
    startSocialResizeRun,
    type IdbOriginalsPlan,
    type IdbOriginalsSocialRun,
    type IdbOriginalsVariantMode,
  } from '$lib/utils/idb-originals';
  import { ensureAccountLoaded } from '$lib/utils/idb-account';
  import { untrack } from 'svelte';

  type Props = {
    terms: TagSearchDto;
    immichUrl?: string;
    onClose: () => void;
  };

  let { terms, immichUrl, onClose }: Props = $props();

  const SOCIAL_OUT_STORAGE_KEY = 'idb-originals-social-out';

  const loadSocialOut = (): string => {
    if (typeof localStorage === 'undefined') {
      return '';
    }

    return localStorage.getItem(SOCIAL_OUT_STORAGE_KEY) ?? '';
  };

  type Phase =
    | 'collecting'
    | 'ready'
    | 'exporting'
    | 'exported'
    | 'downloading'
    | 'downloaded'
    | 'social-running'
    | 'social-done';

  const CLOSE_PHASES: Phase[] = ['downloaded', 'exported', 'social-running', 'social-done'];

  let phase = $state<Phase>('collecting');
  let collectedCount = $state(0);
  let plan = $state<IdbOriginalsPlan | null>(null);
  let variantMode = $state<IdbOriginalsVariantMode>('clean');
  let socialEnabled = $state(false);
  let socialOut = $state(loadSocialOut());
  let socialRun = $state<IdbOriginalsSocialRun | null>(null);
  let startedCount = $state(0);
  let totalCount = $state(0);
  let downloads: { cancel: () => void } | null = $state(null);
  let socialPoll: ReturnType<typeof setInterval> | null = null;
  let command = $state('');
  let commandInput: HTMLInputElement | null = $state(null);
  let copied = $state(false);

  let assetCount = $derived(plan?.assets.length ?? 0);
  let unresolvedCount = $derived(plan ? plan.assets.filter((asset) => asset.uiDriveId === null).length : 0);

  const collect = async () => {
    try {
      const collected = await collectMatchingAssets(terms, $lang, (count) => {
        collectedCount = count;
      });
      plan = await buildOriginalsPlan({ assets: collected, terms, immichUrl, variantMode });
      phase = 'ready';
    } catch (error) {
      handleError(error, $t('loading_search_results_failed'));
      onClose();
    }
  };

  $effect(() => {
    // collect exactly once when the modal opens
    untrack(() => void collect());
  });

  const prefillSocialOut = async () => {
    if (socialOut.trim()) {
      return;
    }

    const health = await fetchSocialHelperHealth();
    if (health?.out && !socialOut.trim()) {
      socialOut = health.out;
    }
  };

  $effect(() => {
    if (!socialEnabled) {
      return;
    }

    untrack(() => void prefillSocialOut());
  });

  const stopSocialPolling = () => {
    if (socialPoll === null) {
      return;
    }

    clearInterval(socialPoll);
    socialPoll = null;
  };

  const pollSocialRun = (runId: string) => {
    stopSocialPolling();

    const poll = async () => {
      try {
        const run = await getSocialResizeRun(runId);
        socialRun = run;

        if (run.status === 'done') {
          stopSocialPolling();
          phase = 'social-done';
        } else if (run.status === 'failed') {
          stopSocialPolling();
          toastManager.danger($t('idb_originals_social_failed'));
          phase = 'social-done';
        }
      } catch {
        // keep polling; the helper may be temporarily unreachable
      }
    };

    socialPoll = setInterval(() => void poll(), 1000);
    void poll();
  };

  const close = () => {
    downloads?.cancel();
    downloads = null;
    stopSocialPolling();
    onClose();
  };

  const withSocial = (base: IdbOriginalsPlan): IdbOriginalsPlan => ({
    ...base,
    variantMode,
    ...(socialEnabled && { social: { enabled: true, maxDimension: IDB_ORIGINALS_SOCIAL_MAX_DIMENSION } }),
  });

  const handleDownloadNow = async () => {
    if (!plan) {
      return;
    }

    if (socialEnabled) {
      const out = socialOut.trim();
      if (!out) {
        toastManager.danger($t('idb_originals_social_out_required'));
        return;
      }

      socialOut = out;
      localStorage.setItem(SOCIAL_OUT_STORAGE_KEY, out);
      socialRun = null;
      phase = 'social-running';

      try {
        const runId = await startSocialResizeRun(withSocial(plan), out);
        pollSocialRun(runId);
      } catch (error) {
        handleError(error, $t('idb_originals_social_offline'));
        phase = 'ready';
      }

      return;
    }

    const driveIds = expandDownloadDriveIds(plan.assets, variantMode);
    await ensureAccountLoaded();
    startedCount = 0;
    totalCount = driveIds.length;
    phase = 'downloading';
    downloads = startBrowserDownloads(driveIds, {
      onProgress: (started, total) => {
        startedCount = started;
        totalCount = total;
      },
      onDone: (total) => {
        totalCount = total;
        phase = 'downloaded';
      },
    });
  };

  const handleCancelDownloads = () => {
    downloads?.cancel();
    downloads = null;
    phase = 'ready';
  };

  const handleExport = () => {
    if (!plan) {
      return;
    }

    phase = 'exporting';
    try {
      const fileName = originalsPlanFileName();
      downloadOriginalsPlan(withSocial(plan), fileName);
      command = originalsFetchCommand(fileName);
      copied = false;
      toastManager.primary($t('idb_originals_exported'));
      phase = 'exported';
    } catch (error) {
      handleError(error, $t('idb_originals_export_failed'));
      phase = 'ready';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      copied = true;
    } catch {
      commandInput?.focus();
      commandInput?.select();
    }
  };
</script>

<Modal size="small" title={$t('idb_originals_plan_title')} icon={mdiDownload} onClose={close}>
  <ModalBody>
    {#if phase === 'collecting'}
      <div class="flex flex-col items-center gap-4 py-4" data-idb-originals-collecting>
        <LoadingSpinner />
        <p data-idb-originals-count>{$t('idb_originals_collecting', { values: { count: collectedCount } })}</p>
      </div>
    {:else if phase === 'downloading'}
      <div class="flex flex-col gap-4" data-idb-originals-downloading>
        <p>{$t('idb_originals_downloading', { values: { started: startedCount, total: totalCount } })}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{$t('idb_originals_download_hint')}</p>
      </div>
    {:else if phase === 'downloaded'}
      <div class="flex flex-col gap-4" data-idb-originals-download-done>
        <p>{$t('idb_originals_download_done', { values: { count: totalCount } })}</p>
      </div>
    {:else if phase === 'social-running'}
      <div class="flex flex-col gap-4" data-idb-originals-social-progress>
        <div class="flex items-center gap-2">
          <LoadingSpinner />
          {#if socialRun?.phase === 'downloading' && socialRun.total > 0}
            <p>
              {$t('idb_originals_social_running', {
                values: { processed: socialRun.processed, total: socialRun.total },
              })}
            </p>
          {:else}
            <p>{$t('idb_originals_social_enumerating', { values: { count: assetCount } })}</p>
          {/if}
        </div>
        {#if socialRun && socialRun.log.length > 0}
          <p class="text-sm text-gray-500 dark:text-gray-400">{socialRun.log.at(-1)}</p>
        {/if}
      </div>
    {:else if phase === 'social-done'}
      <div class="flex flex-col gap-4" data-idb-originals-social-summary>
        <p>
          {$t('idb_originals_social_done', {
            values: {
              downloaded: socialRun?.counts.downloaded ?? 0,
              resized: socialRun?.counts.resized ?? 0,
              skipped: socialRun?.counts.skipped ?? 0,
              failed: socialRun?.counts.failed ?? 0,
            },
          })}
        </p>
        {#if socialRun?.reportPath}
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {$t('idb_originals_social_report', { values: { path: socialRun.reportPath } })}
          </p>
        {/if}
        {#if socialRun?.error}
          <p class="text-sm text-red-500 dark:text-red-400" data-idb-originals-social-error>{socialRun.error}</p>
        {/if}
      </div>
    {:else if phase === 'ready' || phase === 'exporting'}
      <div class="flex flex-col gap-4" data-idb-originals-ready>
        <p data-idb-originals-count>{$t('idb_originals_ready', { values: { count: assetCount } })}</p>
        {#if unresolvedCount > 0}
          <p class="text-sm text-gray-500 dark:text-gray-400" data-idb-originals-unresolved>
            {$t('idb_originals_unresolved_note', { values: { count: unresolvedCount } })}
          </p>
        {/if}
        <fieldset class="flex flex-col gap-2">
          <legend class="mb-1 text-sm font-medium">{$t('idb_originals_variant_label')}</legend>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="idb-originals-variant"
              value="clean"
              bind:group={variantMode}
              data-idb-originals-variant-clean
            />
            {$t('idb_download_without_watermark')}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="idb-originals-variant"
              value="watermark"
              bind:group={variantMode}
              data-idb-originals-variant-watermark
            />
            {$t('idb_download_with_watermark')}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="idb-originals-variant"
              value="both"
              bind:group={variantMode}
              data-idb-originals-variant-both
            />
            {$t('idb_originals_variant_both')}
          </label>
        </fieldset>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <Checkbox id="idb-originals-social" bind:checked={socialEnabled} data-idb-originals-social />
            <Label label={$t('idb_originals_social_resize')} for="idb-originals-social" />
          </div>
          {#if socialEnabled}
            <p class="text-sm text-gray-500 dark:text-gray-400" data-idb-originals-social-hint>
              {$t('idb_originals_social_helper_hint')}
            </p>
            <label class="flex flex-col gap-1 text-sm font-medium">
              {$t('idb_originals_social_out_label')}
              <Input bind:value={socialOut} data-idb-originals-social-out />
            </label>
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-4" data-idb-originals-exported>
        <p data-idb-originals-count>{$t('idb_originals_ready', { values: { count: assetCount } })}</p>
        <label class="flex flex-col gap-1 text-sm font-medium">
          {$t('idb_originals_command_label')}
          <Input bind:ref={commandInput} readonly value={command} data-idb-originals-command />
        </label>
        <Button variant="ghost" color="secondary" data-idb-originals-copy onclick={handleCopy}>
          {copied ? $t('idb_originals_copied') : $t('idb_originals_copy_command')}
        </Button>
      </div>
    {/if}
  </ModalBody>

  {#if phase === 'ready' || phase === 'exporting'}
    <ModalFooter>
      <div class="flex w-full flex-col gap-2">
        <Button
          color="primary"
          fullWidth
          disabled={phase === 'exporting'}
          data-idb-originals-download-now
          onclick={handleDownloadNow}
        >
          {$t('idb_originals_download_now')}
        </Button>
        <Button
          variant="ghost"
          color="secondary"
          fullWidth
          loading={phase === 'exporting'}
          data-idb-originals-export
          onclick={handleExport}
        >
          {$t('idb_originals_export')}
        </Button>
      </div>
    </ModalFooter>
  {:else if phase === 'downloading'}
    <ModalFooter>
      <Button color="secondary" fullWidth data-idb-originals-download-cancel onclick={handleCancelDownloads}>
        {$t('cancel')}
      </Button>
    </ModalFooter>
  {:else if CLOSE_PHASES.includes(phase)}
    <ModalFooter>
      <Button color="primary" fullWidth data-idb-originals-close onclick={close}>{$t('close')}</Button>
    </ModalFooter>
  {/if}
</Modal>
