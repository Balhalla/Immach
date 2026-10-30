import { AssetVisibility, searchAssets, searchSmart, type AssetResponseDto, type SearchResponseDto } from '@immich/sdk';
import { DateTime } from 'luxon';
import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
import type { TagSearchDto } from '$lib/types';
import { basenameOf, buildDownloadUrl, resolveDriveId } from '$lib/utils/idb-drive';
import { getDriveIdOverride } from '$lib/utils/idb-drive-overrides';
import { getVariantEntry } from '$lib/utils/idb-variants';
import { toApiSearchDto } from '$lib/utils/tag-search';

export const IDB_ORIGINALS_PLAN_SCHEMA_VERSION = 1;
export const IDB_ORIGINALS_SOCIAL_MAX_DIMENSION = 1080;
export const IDB_ORIGINALS_HELPER_URL = 'http://127.0.0.1:2285';

const MAX_PAGES = 100;
const COLLECT_PAGE_SIZE = 1000;
const HELPER_HEALTH_TIMEOUT_MS = 2000;

export type IdbOriginalsVariantMode = 'clean' | 'watermark' | 'both';
export type IdbOriginalsResolvedBy = 'override' | 'embedded-id' | null;
export type IdbOriginalsSocial = { enabled: boolean; maxDimension: number };

export type IdbOriginalsSocialRun = {
  runId: string;
  status: 'running' | 'done' | 'failed';
  phase: 'enumerating' | 'downloading' | null;
  exitCode: number | null;
  processed: number;
  total: number;
  counts: { downloaded: number; resized: number; skipped: number; failed: number; unresolved: number };
  reportPath: string | null;
  log: string[];
  error: string | null;
};

/**
 * Frozen plan schema v1 (docs/MAPPING.md §8 in the bridge repo):
 *
 * {
 *   "schemaVersion": 1,
 *   "generatedAt": "ISO",
 *   "source": { "immichUrl": "string (optional)", "search": {}, "assetCount": 0 },
 *   "variantMode": "clean" | "watermark" | "both",
 *   "assets": [{
 *     "assetId": "uuid", "originalFileName": "string", "originalPath": "string",
 *     "checksumBase64Sha1": "string|null (optional)", "uiDriveId": "string|null",
 *     "uiResolvedBy": "override"|"embedded-id"|null (optional),
 *     "variant": { "cleanDriveId": "string", "watermarkDriveIds": ["string"] } | null (optional)
 *   }],
 *   "social": { "enabled": true, "maxDimension": 1080 } (optional; emitted only when enabled,
 *             absent/null keeps the full-size behavior)
 * }
 */

export type IdbOriginalsVariant = {
  cleanDriveId: string;
  watermarkDriveIds: string[];
};

export type IdbOriginalsPlanAsset = {
  assetId: string;
  originalFileName: string;
  originalPath: string;
  checksumBase64Sha1: string | null;
  uiDriveId: string | null;
  uiResolvedBy: IdbOriginalsResolvedBy;
  variant: IdbOriginalsVariant | null;
};

export type IdbOriginalsPlan = {
  schemaVersion: typeof IDB_ORIGINALS_PLAN_SCHEMA_VERSION;
  generatedAt: string;
  source: {
    immichUrl?: string;
    search: TagSearchDto;
    assetCount: number;
  };
  variantMode: IdbOriginalsVariantMode;
  assets: IdbOriginalsPlanAsset[];
  social?: IdbOriginalsSocial | null;
};

export type BuildOriginalsPlanOptions = {
  assets: AssetResponseDto[];
  terms: TagSearchDto;
  immichUrl?: string;
  variantMode: IdbOriginalsVariantMode;
  generatedAt?: string;
  social?: IdbOriginalsSocial;
};

/**
 * Pages through every asset matching the active search, mirroring the search page dispatch:
 * structured tag searches use the cursor, all other searches use the page number, and smart
 * search is used only when a query/queryAssetId is present and the feature flag is on.
 */
export const collectMatchingAssets = async (
  terms: TagSearchDto,
  lang: string,
  onProgress?: (collectedCount: number) => void,
): Promise<AssetResponseDto[]> => {
  const hasStructuredTags = Array.isArray(terms.tagIds) && terms.tagIds.length > 0;
  const collected: AssetResponseDto[] = [];
  let nextPage = 1;
  let nextCursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const searchDto: TagSearchDto = {
      visibility: AssetVisibility.Timeline,
      withExif: true,
      size: COLLECT_PAGE_SIZE,
      ...(hasStructuredTags ? (nextCursor ? { cursor: nextCursor } : {}) : { page: nextPage }),
      ...terms,
    };

    const apiDto = toApiSearchDto(searchDto);
    const response: SearchResponseDto =
      (apiDto.query || apiDto.queryAssetId) && featureFlagsManager.value.smartSearch
        ? await searchSmart({ smartSearchDto: { ...apiDto, language: lang } })
        : await searchAssets({ metadataSearchDto: apiDto });

    collected.push(...response.assets.items);
    onProgress?.(collected.length);

    if (response.assets.items.length === 0) {
      break;
    }

    nextPage = Number(response.assets.nextPage) || 0;
    nextCursor = response.assets.nextCursor ?? null;

    if (hasStructuredTags ? !nextCursor : !nextPage) {
      break;
    }
  }

  return collected;
};

const buildPlanAsset = async (asset: AssetResponseDto): Promise<IdbOriginalsPlanAsset> => {
  const override =
    (await getDriveIdOverride(asset.originalFileName)) ?? (await getDriveIdOverride(basenameOf(asset.originalPath)));

  let uiDriveId: string | null;
  let uiResolvedBy: IdbOriginalsResolvedBy;
  if (override) {
    uiDriveId = override;
    uiResolvedBy = 'override';
  } else {
    uiDriveId = resolveDriveId(asset);
    uiResolvedBy = uiDriveId ? 'embedded-id' : null;
  }

  const variantEntry = await getVariantEntry(uiDriveId);
  const variant = variantEntry
    ? { cleanDriveId: variantEntry.cleanDriveId, watermarkDriveIds: [...variantEntry.watermarkDriveIds] }
    : null;

  return {
    assetId: asset.id,
    originalFileName: asset.originalFileName,
    originalPath: asset.originalPath,
    checksumBase64Sha1: asset.checksum ?? null,
    uiDriveId,
    uiResolvedBy,
    variant,
  };
};

export const buildOriginalsPlan = async ({
  assets,
  terms,
  immichUrl,
  variantMode,
  generatedAt = new Date().toISOString(),
  social,
}: BuildOriginalsPlanOptions): Promise<IdbOriginalsPlan> => {
  const planAssets: IdbOriginalsPlanAsset[] = [];
  for (const asset of assets) {
    planAssets.push(await buildPlanAsset(asset));
  }

  return {
    schemaVersion: IDB_ORIGINALS_PLAN_SCHEMA_VERSION,
    generatedAt,
    source: {
      ...(immichUrl && { immichUrl }),
      search: { ...terms },
      assetCount: assets.length,
    },
    variantMode,
    assets: planAssets,
    ...(social?.enabled && { social: { enabled: true, maxDimension: social.maxDimension } }),
  };
};

/**
 * Resolves the Drive IDs to download for the chosen variant mode. A watermark twin only applies
 * when the variant entry belongs to the asset's own clean id; twinless assets fall back to their
 * own `uiDriveId`. IDs are de-duplicated globally, first-seen order preserved.
 */
export const expandDownloadDriveIds = (
  assets: IdbOriginalsPlanAsset[],
  variantMode: IdbOriginalsVariantMode,
): string[] => {
  const driveIds: string[] = [];
  const seen = new Set<string>();
  const push = (driveId: string | null | undefined) => {
    if (!driveId || seen.has(driveId)) {
      return;
    }

    seen.add(driveId);
    driveIds.push(driveId);
  };

  for (const { uiDriveId, variant } of assets) {
    if (!uiDriveId) {
      continue;
    }

    if (variantMode === 'clean' || variant === null || variant.cleanDriveId !== uiDriveId) {
      push(uiDriveId);
      continue;
    }

    if (variantMode === 'watermark') {
      push(variant.watermarkDriveIds[0] ?? uiDriveId);
      continue;
    }

    push(uiDriveId);
    for (const watermarkDriveId of variant.watermarkDriveIds) {
      push(watermarkDriveId);
    }
  }

  return driveIds;
};

/**
 * Page-initiated downloads only (SPK-1): navigates a hidden iframe to the Drive download URL
 * once per id, spaced by `delayMs` so the browser can queue the downloads. No fetch, no
 * window.open.
 */
export const startBrowserDownloads = (
  driveIds: string[],
  handlers: { onProgress?: (started: number, total: number) => void; onDone?: (total: number) => void } = {},
  delayMs = 700,
): { cancel: () => void } => {
  const total = driveIds.length;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.append(iframe);

  let interval: ReturnType<typeof setInterval> | undefined;
  let index = 0;
  let cancelled = false;

  const cleanup = () => {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }

    iframe.remove();
  };

  const issueNext = () => {
    if (cancelled || index >= total) {
      return;
    }

    iframe.src = buildDownloadUrl(driveIds[index]);
    index++;
    handlers.onProgress?.(index, total);

    if (index >= total) {
      cleanup();
      handlers.onDone?.(total);
    }
  };

  const cancel = () => {
    cancelled = true;
    cleanup();
  };

  if (total === 0) {
    cleanup();
    handlers.onDone?.(0);
    return { cancel };
  }

  issueNext();
  if (index < total) {
    interval = setInterval(issueNext, delayMs);
  }

  return { cancel };
};

export const originalsPlanFileName = (date = new Date()): string => {
  return `idb-originals-plan-${DateTime.fromJSDate(date).toFormat('yyyyLLdd-HHmmss')}.json`;
};

export const downloadOriginalsPlan = (plan: IdbOriginalsPlan, fileName: string): void => {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

export const originalsFetchCommand = (fileName: string): string => {
  return `npm run originals -- --plan "${fileName}" --out <target-folder>`;
};

/** Returns the helper default output folder, or null when the helper is unreachable or unhealthy. */
export const fetchSocialHelperHealth = async (): Promise<{ out: string | null } | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HELPER_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${IDB_ORIGINALS_HELPER_URL}/health`, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { ok?: boolean; out?: string | null };
    if (!body.ok) {
      return null;
    }

    return { out: body.out ?? null };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const startSocialResizeRun = async (plan: IdbOriginalsPlan, out: string): Promise<string> => {
  const response = await fetch(`${IDB_ORIGINALS_HELPER_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, out }),
  });

  const body = (await response.json().catch(() => null)) as { runId?: string; error?: string } | null;

  if (response.status !== 202) {
    throw new Error(body?.error ?? `social helper responded with ${response.status}`);
  }

  if (!body?.runId) {
    throw new Error('social helper did not return a run id');
  }

  return body.runId;
};

export const getSocialResizeRun = async (runId: string): Promise<IdbOriginalsSocialRun> => {
  const response = await fetch(`${IDB_ORIGINALS_HELPER_URL}/runs/${encodeURIComponent(runId)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `social helper responded with ${response.status}`);
  }

  return (await response.json()) as IdbOriginalsSocialRun;
};
