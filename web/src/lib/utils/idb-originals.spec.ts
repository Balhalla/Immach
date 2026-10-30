import { AssetVisibility, searchAssets, searchSmart, type AssetResponseDto, type SearchResponseDto } from '@immich/sdk';
import type { TagSearchDto } from '$lib/types';
import { buildDownloadUrl } from '$lib/utils/idb-drive';
import { getDriveIdOverride } from '$lib/utils/idb-drive-overrides';
import {
  buildOriginalsPlan,
  collectMatchingAssets,
  expandDownloadDriveIds,
  fetchSocialHelperHealth,
  getSocialResizeRun,
  IDB_ORIGINALS_HELPER_URL,
  IDB_ORIGINALS_PLAN_SCHEMA_VERSION,
  originalsFetchCommand,
  originalsPlanFileName,
  startBrowserDownloads,
  startSocialResizeRun,
  type IdbOriginalsPlan,
  type IdbOriginalsPlanAsset,
  type IdbOriginalsSocialRun,
} from '$lib/utils/idb-originals';
import { getVariantEntry } from '$lib/utils/idb-variants';

const flags = vi.hoisted(() => ({ smartSearch: false }));

vi.mock('$lib/managers/feature-flags-manager.svelte', () => ({
  featureFlagsManager: { value: flags },
}));

vi.mock('@immich/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@immich/sdk')>();
  return {
    ...actual,
    searchAssets: vi.fn(),
    searchSmart: vi.fn(),
  };
});

vi.mock('$lib/utils/idb-drive-overrides', () => ({
  getDriveIdOverride: vi.fn(),
}));

vi.mock('$lib/utils/idb-variants', () => ({
  getVariantEntry: vi.fn(),
}));

// happy-dom would actually navigate the hidden iframe (and fetch the Drive URL) on src assignment;
// keep the assignment observable without leaving the test realm.
const iframeSrc = new WeakMap<HTMLIFrameElement, string>();
Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
  configurable: true,
  get(this: HTMLIFrameElement) {
    return iframeSrc.get(this) ?? '';
  },
  set(this: HTMLIFrameElement, value: string) {
    iframeSrc.set(this, value);
  },
});

const DRIVE_ID = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub';
const CLEAN_ID = 'cleanDriveId000000000000000001';
const WATERMARK_ID = 'watermarkDriveId000000000001A';
const WATERMARK_ID_2 = 'watermarkDriveId000000000001B';

const makeAsset = (id: string, overrides: Partial<AssetResponseDto> = {}): AssetResponseDto =>
  ({
    id,
    checksum: `checksum-${id}`,
    originalFileName: `${id}.jpg`,
    originalPath: `/library/${id}.jpg`,
    ...overrides,
  }) as AssetResponseDto;

const searchResponse = (
  items: AssetResponseDto[],
  next: { nextCursor?: string | null; nextPage?: string | null } = {},
): SearchResponseDto => ({
  albums: { count: 0, facets: [], items: [], total: 0 },
  assets: {
    count: items.length,
    facets: [],
    items,
    nextCursor: next.nextCursor ?? null,
    nextPage: next.nextPage ?? null,
    total: items.length,
  },
});

const planAsset = (
  uiDriveId: string | null,
  variant: IdbOriginalsPlanAsset['variant'] = null,
): IdbOriginalsPlanAsset => ({
  assetId: uiDriveId ?? 'unresolved',
  originalFileName: `${uiDriveId ?? 'unresolved'}.jpg`,
  originalPath: `/library/${uiDriveId ?? 'unresolved'}.jpg`,
  checksumBase64Sha1: null,
  uiDriveId,
  uiResolvedBy: uiDriveId ? 'embedded-id' : null,
  variant,
});

describe('idb-originals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    flags.smartSearch = false;
    vi.mocked(getDriveIdOverride).mockResolvedValue(null);
    vi.mocked(getVariantEntry).mockResolvedValue(null);
  });

  describe('collectMatchingAssets', () => {
    it('collects all metadata pages using page numbers', async () => {
      const a = makeAsset('a');
      const b = makeAsset('b');
      const c = makeAsset('c');
      vi.mocked(searchAssets)
        .mockResolvedValueOnce(searchResponse([a, b], { nextPage: '2' }))
        .mockResolvedValueOnce(searchResponse([c], { nextPage: null }));
      const onProgress = vi.fn();

      const result = await collectMatchingAssets({ personIds: ['p1'] }, 'en', onProgress);

      expect(result).toEqual([a, b, c]);
      expect(searchAssets).toHaveBeenCalledTimes(2);
      expect(searchSmart).not.toHaveBeenCalled();
      expect(vi.mocked(searchAssets).mock.calls[0][0].metadataSearchDto).toMatchObject({
        visibility: AssetVisibility.Timeline,
        withExif: true,
        size: 1000,
        page: 1,
        personIds: ['p1'],
      });
      expect(vi.mocked(searchAssets).mock.calls[1][0].metadataSearchDto).toMatchObject({ page: 2 });
      expect(onProgress).toHaveBeenNthCalledWith(1, 2);
      expect(onProgress).toHaveBeenNthCalledWith(2, 3);
    });

    it('collects structured tag pages using the cursor and translates the dto', async () => {
      const a = makeAsset('a');
      const b = makeAsset('b');
      vi.mocked(searchAssets)
        .mockResolvedValueOnce(searchResponse([a], { nextCursor: 'cursor-1' }))
        .mockResolvedValueOnce(searchResponse([b], { nextCursor: null }));

      const result = await collectMatchingAssets({ tagIds: ['t1', 't2'], tagMatch: 'any' }, 'nl');

      expect(result).toEqual([a, b]);
      expect(searchAssets).toHaveBeenCalledTimes(2);
      const firstDto = vi.mocked(searchAssets).mock.calls[0][0].metadataSearchDto;
      expect(firstDto.page).toBeUndefined();
      expect(firstDto.cursor).toBeUndefined();
      expect(firstDto.filter?.tagIds).toEqual({ any: ['t1', 't2'] });
      expect(vi.mocked(searchAssets).mock.calls[1][0].metadataSearchDto.cursor).toBe('cursor-1');
    });

    it('stops when a page adds no items', async () => {
      vi.mocked(searchAssets).mockResolvedValueOnce(searchResponse([], { nextCursor: 'cursor-1', nextPage: '2' }));

      const result = await collectMatchingAssets({ tagIds: ['t1'] }, 'en');

      expect(result).toEqual([]);
      expect(searchAssets).toHaveBeenCalledTimes(1);
    });

    it('stops after the safety page cap', async () => {
      vi.mocked(searchAssets).mockResolvedValue(searchResponse([makeAsset('a')], { nextPage: '2' }));

      const result = await collectMatchingAssets({}, 'en');

      expect(searchAssets).toHaveBeenCalledTimes(100);
      expect(result).toHaveLength(100);
    });

    it('uses smart search for queries when the feature flag is enabled', async () => {
      flags.smartSearch = true;
      const asset = makeAsset('a');
      vi.mocked(searchSmart).mockResolvedValueOnce(searchResponse([asset], { nextCursor: null }));

      const result = await collectMatchingAssets({ query: 'sunset', tagIds: ['t1'] }, 'nl');

      expect(result).toEqual([asset]);
      expect(searchAssets).not.toHaveBeenCalled();
      expect(vi.mocked(searchSmart).mock.calls[0][0].smartSearchDto).toMatchObject({
        language: 'nl',
        query: 'sunset',
        filter: { tagIds: { all: ['t1'] } },
      });
    });

    it('keeps using metadata search for queries when the feature flag is disabled', async () => {
      const asset = makeAsset('a');
      vi.mocked(searchAssets).mockResolvedValueOnce(searchResponse([asset], { nextPage: null }));

      await collectMatchingAssets({ query: 'sunset' }, 'en');

      expect(searchSmart).not.toHaveBeenCalled();
      expect(searchAssets).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildOriginalsPlan', () => {
    const terms: TagSearchDto = { tagIds: ['t1'], tagMatch: 'all' };

    it('resolves overrides, embedded ids and unresolved assets and keeps every asset', async () => {
      const overrideAsset = makeAsset('override', {
        originalFileName: 'a__OVERRIDE_FILE.jpg',
        checksum: 'override-checksum',
      });
      const embeddedAsset = makeAsset('embedded', { originalFileName: `b__${DRIVE_ID}.jpg` });
      const unresolvedAsset = makeAsset('unresolved', {
        originalFileName: 'c.jpg',
        originalPath: '/library/c.jpg',
      });

      vi.mocked(getDriveIdOverride).mockImplementation((fileName) =>
        Promise.resolve(fileName === 'a__OVERRIDE_FILE.jpg' ? 'overrideDriveId' : null),
      );

      const plan = await buildOriginalsPlan({
        assets: [overrideAsset, embeddedAsset, unresolvedAsset],
        terms,
        immichUrl: 'https://immich.example',
        variantMode: 'both',
        generatedAt: '2026-10-02T12:00:00.000Z',
      });

      expect(plan.schemaVersion).toBe(IDB_ORIGINALS_PLAN_SCHEMA_VERSION);
      expect(plan.schemaVersion).toBe(1);
      expect(plan.generatedAt).toBe('2026-10-02T12:00:00.000Z');
      expect(plan.variantMode).toBe('both');
      expect(plan.source).toEqual({ immichUrl: 'https://immich.example', search: terms, assetCount: 3 });
      expect(plan.assets).toHaveLength(3);
      expect(plan.assets[0]).toMatchObject({
        assetId: 'override',
        originalFileName: 'a__OVERRIDE_FILE.jpg',
        originalPath: '/library/override.jpg',
        checksumBase64Sha1: 'override-checksum',
        uiDriveId: 'overrideDriveId',
        uiResolvedBy: 'override',
      });
      expect(plan.assets[1]).toMatchObject({ assetId: 'embedded', uiDriveId: DRIVE_ID, uiResolvedBy: 'embedded-id' });
      expect(plan.assets[2]).toMatchObject({
        assetId: 'unresolved',
        checksumBase64Sha1: 'checksum-unresolved',
        uiDriveId: null,
        uiResolvedBy: null,
        variant: null,
      });
    });

    it('checks the file name override before the path basename override', async () => {
      const asset = makeAsset('a', {
        originalFileName: 'a.jpg',
        originalPath: String.raw`C:\mirror\b__PATH_OVERRIDE.jpg`,
      });
      vi.mocked(getDriveIdOverride).mockImplementation((fileName) =>
        Promise.resolve(fileName === 'b__PATH_OVERRIDE.jpg' ? 'pathOverrideDriveId' : null),
      );

      const plan = await buildOriginalsPlan({ assets: [asset], terms: {}, variantMode: 'clean' });

      expect(vi.mocked(getDriveIdOverride).mock.calls).toEqual([['a.jpg'], ['b__PATH_OVERRIDE.jpg']]);
      expect(plan.assets[0]).toMatchObject({ uiDriveId: 'pathOverrideDriveId', uiResolvedBy: 'override' });
    });

    it('attaches the variant entry resolved from the UI drive id', async () => {
      const asset = makeAsset('a', { originalFileName: `a__${DRIVE_ID}.jpg` });
      vi.mocked(getVariantEntry).mockResolvedValue({
        cleanDriveId: CLEAN_ID,
        cleanName: 'a.jpg',
        watermarkDriveIds: [WATERMARK_ID],
        match: 'met-zonder',
        confidence: 'high',
        driveFolder: '2026/02/25',
      });

      const plan = await buildOriginalsPlan({ assets: [asset], terms: {}, variantMode: 'clean' });

      expect(getVariantEntry).toHaveBeenCalledWith(DRIVE_ID);
      expect(plan.assets[0].variant).toEqual({ cleanDriveId: CLEAN_ID, watermarkDriveIds: [WATERMARK_ID] });
    });

    it('maps a missing checksum to null and omits immichUrl when not provided', async () => {
      const asset = makeAsset('a');
      Object.assign(asset, { checksum: undefined });

      const plan = await buildOriginalsPlan({ assets: [asset], terms: {}, variantMode: 'clean' });

      expect(plan.assets[0].checksumBase64Sha1).toBeNull();
      expect(plan.source.immichUrl).toBeUndefined();
      expect(plan.source.assetCount).toBe(1);
    });

    it('emits the social block when enabled', async () => {
      const plan = await buildOriginalsPlan({
        assets: [makeAsset('a')],
        terms: {},
        variantMode: 'clean',
        social: { enabled: true, maxDimension: 1080 },
      });

      expect(plan.social).toEqual({ enabled: true, maxDimension: 1080 });
    });

    it('omits the social block when absent or disabled', async () => {
      const absent = await buildOriginalsPlan({ assets: [makeAsset('a')], terms: {}, variantMode: 'clean' });
      const disabled = await buildOriginalsPlan({
        assets: [makeAsset('a')],
        terms: {},
        variantMode: 'clean',
        social: { enabled: false, maxDimension: 1080 },
      });

      expect(absent.social).toBeUndefined();
      expect(disabled.social).toBeUndefined();
      expect('social' in absent).toBe(false);
      expect('social' in disabled).toBe(false);
    });
  });

  describe('expandDownloadDriveIds', () => {
    const twin = (cleanDriveId: string, watermarkDriveIds: string[]) => ({ cleanDriveId, watermarkDriveIds });

    it('clean downloads only the ui drive id', () => {
      const assets = [planAsset(CLEAN_ID, twin(CLEAN_ID, [WATERMARK_ID, WATERMARK_ID_2]))];

      expect(expandDownloadDriveIds(assets, 'clean')).toEqual([CLEAN_ID]);
    });

    it('watermark downloads the first twin when the variant matches', () => {
      const assets = [planAsset(CLEAN_ID, twin(CLEAN_ID, [WATERMARK_ID, WATERMARK_ID_2]))];

      expect(expandDownloadDriveIds(assets, 'watermark')).toEqual([WATERMARK_ID]);
    });

    it('watermark falls back to the ui drive id without a matching twin', () => {
      expect(expandDownloadDriveIds([planAsset(DRIVE_ID)], 'watermark')).toEqual([DRIVE_ID]);
      expect(expandDownloadDriveIds([planAsset(DRIVE_ID, twin(CLEAN_ID, [WATERMARK_ID]))], 'watermark')).toEqual([
        DRIVE_ID,
      ]);
    });

    it('both downloads the ui drive id plus all twins when the variant matches', () => {
      const assets = [planAsset(CLEAN_ID, twin(CLEAN_ID, [WATERMARK_ID, WATERMARK_ID_2]))];

      expect(expandDownloadDriveIds(assets, 'both')).toEqual([CLEAN_ID, WATERMARK_ID, WATERMARK_ID_2]);
    });

    it('both falls back to the ui drive id without a matching twin', () => {
      expect(expandDownloadDriveIds([planAsset(DRIVE_ID, twin(CLEAN_ID, [WATERMARK_ID]))], 'both')).toEqual([DRIVE_ID]);
    });

    it('deduplicates globally preserving first-seen order and skips unresolved assets', () => {
      const assets = [
        planAsset(null, twin(CLEAN_ID, [WATERMARK_ID])),
        planAsset(CLEAN_ID, twin(CLEAN_ID, [WATERMARK_ID, WATERMARK_ID_2])),
        planAsset(WATERMARK_ID, twin(WATERMARK_ID, [CLEAN_ID])),
        planAsset(null),
      ];

      expect(expandDownloadDriveIds(assets, 'both')).toEqual([CLEAN_ID, WATERMARK_ID, WATERMARK_ID_2]);
    });
  });

  describe('startBrowserDownloads', () => {
    afterEach(() => {
      vi.useRealTimers();
      document.querySelector('iframe')?.remove();
    });

    it('issues the first download immediately and the rest on the interval', () => {
      vi.useFakeTimers();
      const onProgress = vi.fn();
      const onDone = vi.fn();

      startBrowserDownloads(['id-1', 'id-2', 'id-3'], { onProgress, onDone }, 700);
      const iframe = document.querySelector('iframe');

      expect(iframe?.src).toBe(buildDownloadUrl('id-1'));
      expect(onProgress).toHaveBeenLastCalledWith(1, 3);
      expect(onDone).not.toHaveBeenCalled();

      vi.advanceTimersByTime(700);
      expect(iframe?.src).toBe(buildDownloadUrl('id-2'));
      expect(onProgress).toHaveBeenLastCalledWith(2, 3);

      vi.advanceTimersByTime(700);
      expect(iframe?.src).toBe(buildDownloadUrl('id-3'));
      expect(onProgress).toHaveBeenLastCalledWith(3, 3);
      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onDone).toHaveBeenCalledWith(3);
      expect(document.querySelector('iframe')).toBeNull();

      vi.advanceTimersByTime(7000);
      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('cancel stops further assignments and removes the iframe', () => {
      vi.useFakeTimers();
      const onProgress = vi.fn();
      const onDone = vi.fn();

      const { cancel } = startBrowserDownloads(['id-1', 'id-2', 'id-3'], { onProgress, onDone }, 700);
      const iframe = document.querySelector('iframe');

      cancel();
      vi.advanceTimersByTime(7000);

      expect(iframe?.src).toBe(buildDownloadUrl('id-1'));
      expect(onProgress).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
      expect(document.querySelector('iframe')).toBeNull();
    });

    it('completes immediately without downloads when there are no ids', () => {
      const onDone = vi.fn();

      startBrowserDownloads([], { onDone });

      expect(onDone).toHaveBeenCalledWith(0);
      expect(document.querySelector('iframe')).toBeNull();
    });
  });

  describe('plan file helpers', () => {
    it('builds a timestamped file name', () => {
      expect(originalsPlanFileName(new Date(Date.UTC(2026, 9, 2, 14, 5, 9)))).toBe(
        'idb-originals-plan-20261002-140509.json',
      );
    });

    it('builds the Windows-first fetch command', () => {
      expect(originalsFetchCommand('idb-originals-plan-20261002-140509.json')).toBe(
        'npm run originals -- --plan "idb-originals-plan-20261002-140509.json" --out <target-folder>',
      );
    });
  });

  describe('social helper', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const jsonResponse = (body: unknown, status = 200): Response =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      }) as unknown as Response;

    const helperPlan: IdbOriginalsPlan = {
      schemaVersion: 1,
      generatedAt: '2026-10-03T00:00:00.000Z',
      source: { search: {}, assetCount: 0 },
      variantMode: 'clean',
      assets: [],
    };

    const stubFetch = (implementation: (url: string, init?: RequestInit) => Promise<Response>) => {
      const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        async (input, init) => implementation(String(input), init),
      );
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    };

    it('returns the helper default out on a healthy response', async () => {
      const fetchMock = stubFetch(() =>
        Promise.resolve(jsonResponse({ ok: true, service: 'idb-social-runner', out: String.raw`D:\Social` })),
      );

      await expect(fetchSocialHelperHealth()).resolves.toEqual({ out: String.raw`D:\Social` });
      expect(fetchMock).toHaveBeenCalledWith(
        `${IDB_ORIGINALS_HELPER_URL}/health`,
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    it('maps a missing default out to null', async () => {
      stubFetch(() => Promise.resolve(jsonResponse({ ok: true, service: 'idb-social-runner', out: null })));

      await expect(fetchSocialHelperHealth()).resolves.toEqual({ out: null });
    });

    it('resolves null on a network failure', async () => {
      stubFetch(() => Promise.reject(new TypeError('fetch failed')));

      await expect(fetchSocialHelperHealth()).resolves.toBeNull();
    });

    it('posts the plan and out and returns the run id', async () => {
      const fetchMock = stubFetch(() => Promise.resolve(jsonResponse({ runId: 'run-1' }, 202)));

      await expect(startSocialResizeRun(helperPlan, String.raw`D:\out`)).resolves.toBe('run-1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${IDB_ORIGINALS_HELPER_URL}/run`);
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(String(init?.body))).toEqual({ plan: helperPlan, out: String.raw`D:\out` });
    });

    it('propagates the helper error message on a non-202 response', async () => {
      stubFetch(() => Promise.resolve(jsonResponse({ error: 'a run is already in progress' }, 409)));

      await expect(startSocialResizeRun(helperPlan, String.raw`D:\out`)).rejects.toThrow('a run is already in progress');
    });

    it('returns the polled run object unchanged', async () => {
      const run: IdbOriginalsSocialRun = {
        runId: 'run-1',
        status: 'running',
        phase: 'downloading',
        exitCode: null,
        processed: 3,
        total: 10,
        counts: { downloaded: 2, resized: 1, skipped: 0, failed: 0, unresolved: 0 },
        reportPath: null,
        log: ['downloaded a.jpg'],
        error: null,
      };
      const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(run)));

      await expect(getSocialResizeRun('run-1')).resolves.toEqual(run);
      expect(fetchMock).toHaveBeenCalledWith(`${IDB_ORIGINALS_HELPER_URL}/runs/run-1`);
    });
  });
});
