import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { toastManager } from '@immich/ui';
import { init, register, waitLocale } from 'svelte-i18n';
import { getAnimateMock } from '$lib/__mocks__/animate.mock';
import { getIntersectionObserverMock } from '$lib/__mocks__/intersection-observer.mock';
import { getVisualViewportMock } from '$lib/__mocks__/visual-viewport.mock';
import {
  buildOriginalsPlan,
  collectMatchingAssets,
  downloadOriginalsPlan,
  IDB_ORIGINALS_SOCIAL_MAX_DIMENSION,
  type IdbOriginalsPlan,
} from '$lib/utils/idb-originals';
import OriginalsPlanModal from './OriginalsPlanModal.svelte';

const minimalPlan: IdbOriginalsPlan = {
  schemaVersion: 1,
  generatedAt: '2026-10-03T00:00:00.000Z',
  source: { search: {}, assetCount: 0 },
  variantMode: 'clean',
  assets: [],
};

vi.mock('$lib/utils/idb-originals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/utils/idb-originals')>();
  return {
    ...actual,
    collectMatchingAssets: vi.fn(() => Promise.resolve([])),
    buildOriginalsPlan: vi.fn(() => Promise.resolve(minimalPlan)),
    downloadOriginalsPlan: vi.fn(actual.downloadOriginalsPlan),
  };
});

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const helperHealth = (out: string | null) => jsonResponse({ ok: true, service: 'idb-social-runner', out });

const runPayload = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  status: 'running',
  phase: 'downloading',
  exitCode: null,
  processed: 1,
  total: 10,
  counts: { downloaded: 1, resized: 0, skipped: 0, failed: 0, unresolved: 0 },
  reportPath: null,
  log: ['downloaded a.jpg'],
  error: null,
  ...overrides,
});

const installFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input, init) =>
    handler(String(input), init),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('OriginalsPlanModal component', () => {
  const onClose = vi.fn();
  let dangerSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await init({ fallbackLocale: 'en-US' });
    register('en-US', () => import('$i18n/en.json'));
    await waitLocale('en-US');
  });

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('IntersectionObserver', getIntersectionObserverMock());
    vi.stubGlobal('visualViewport', getVisualViewportMock());
    vi.clearAllMocks();
    Element.prototype.animate = getAnimateMock();
    vi.mocked(collectMatchingAssets).mockResolvedValue([]);
    vi.mocked(buildOriginalsPlan).mockResolvedValue(minimalPlan);
    dangerSpy = vi.spyOn(toastManager, 'danger').mockImplementation(() => {});
    installFetch((url) => {
      if (url.endsWith('/health')) {
        return helperHealth(null);
      }

      throw new Error(`unexpected fetch ${url}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    dangerSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe('none');
    });
  });

  const renderReady = async () => {
    render(OriginalsPlanModal, { props: { terms: {}, onClose } });
    await screen.findByText('matching assets: 0');
  };

  const getSocialCheckbox = () => screen.getByRole('checkbox');
  const getDownloadNow = () => screen.getByRole('button', { name: 'Download now' });
  const getExport = () => screen.getByRole('button', { name: 'Export download plan' });
  const getOutInput = () => document.querySelector('[data-idb-originals-social-out]') as HTMLInputElement;

  it('renders the social tickbox unchecked and keeps Download now enabled by default', async () => {
    await renderReady();

    expect(document.querySelector('[data-idb-originals-social]')).not.toBeNull();
    expect(getSocialCheckbox()).not.toBeChecked();
    expect(getDownloadNow()).toBeEnabled();
    expect(document.querySelector('[data-idb-originals-social-hint]')).toBeNull();
    expect(getOutInput()).toBeNull();
  });

  it('keeps Download now enabled and shows the output input and helper hint when ticked', async () => {
    await renderReady();

    await fireEvent.click(getSocialCheckbox());

    expect(getSocialCheckbox()).toBeChecked();
    expect(getDownloadNow()).toBeEnabled();
    expect(screen.getByText('Resizing runs on this machine — start `npm run social` in the bridge repo')).toBeInTheDocument();
    expect(document.querySelector('[data-idb-originals-social-hint]')).not.toBeNull();
    expect(getOutInput()).toBeInTheDocument();
    expect(screen.getByText('Output folder on this machine')).toBeInTheDocument();
  });

  it('prefills the output folder from the helper default when ticked', async () => {
    installFetch(() => helperHealth(String.raw`D:\Social`));
    await renderReady();

    await fireEvent.click(getSocialCheckbox());

    await waitFor(() => expect(getOutInput()).toHaveValue(String.raw`D:\Social`));
  });

  it('requires a local output folder before starting the helper run', async () => {
    const fetchMock = installFetch((url) => {
      if (url.endsWith('/health')) {
        return helperHealth(null);
      }

      throw new Error(`unexpected fetch ${url}`);
    });
    await renderReady();
    await fireEvent.click(getSocialCheckbox());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.anything()));

    await fireEvent.click(getDownloadNow());

    expect(dangerSpy).toHaveBeenCalledWith('Enter the local output folder first');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    expect(document.querySelector('[data-idb-originals-ready]')).not.toBeNull();
  });

  it('starts a helper run, polls it and renders the summary with counts and report', async () => {
    let polls = 0;
    const fetchMock = installFetch((url, init) => {
      if (url.endsWith('/health')) {
        return helperHealth(null);
      }

      if (url.endsWith('/run') && init?.method === 'POST') {
        return jsonResponse({ runId: 'run-1' }, 202);
      }

      if (url.endsWith('/runs/run-1')) {
        polls++;
        if (polls === 1) {
          return jsonResponse(
            runPayload({ phase: 'enumerating', processed: 0, total: 0, log: ['resolving Drive file IDs'] }),
          );
        }
        if (polls === 2) {
          return jsonResponse(runPayload({ phase: 'downloading', processed: 1, total: 2 }));
        }
        return jsonResponse(
          runPayload({
            status: 'done',
            phase: null,
            exitCode: 0,
            processed: 2,
            counts: { downloaded: 2, resized: 2, skipped: 1, failed: 0, unresolved: 0 },
            reportPath: String.raw`C:\social\report.json`,
            log: ['done'],
          }),
        );
      }

      throw new Error(`unexpected fetch ${url}`);
    });

    await renderReady();
    await fireEvent.click(getSocialCheckbox());
    await fireEvent.input(getOutInput(), { target: { value: String.raw`  C:\social  ` } });

    vi.useFakeTimers();
    await fireEvent.click(getDownloadNow());
    await vi.advanceTimersByTimeAsync(0);

    expect(document.querySelector('[data-idb-originals-social-progress]')).not.toBeNull();
    expect(
      screen.getByText('Resolving Drive file IDs on the host — no downloads yet (plan: 0 assets)'),
    ).toBeInTheDocument();
    expect(screen.getByText('resolving Drive file IDs')).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall?.[0]).toBe('http://127.0.0.1:2285/run');
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      plan: {
        ...minimalPlan,
        variantMode: 'clean',
        social: { enabled: true, maxDimension: IDB_ORIGINALS_SOCIAL_MAX_DIMENSION },
      },
      out: String.raw`C:\social`,
    });
    expect(localStorage.getItem('idb-originals-social-out')).toBe(String.raw`C:\social`);

    await vi.advanceTimersByTimeAsync(1000);

    expect(screen.getByText('Downloading & resizing on the host… 1 of 2')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1000);

    expect(document.querySelector('[data-idb-originals-social-summary]')).not.toBeNull();
    expect(screen.getByText('Downloaded 2, resized 2, skipped 1, failed 0')).toBeInTheDocument();
    expect(screen.getByText(String.raw`Report: C:\social\report.json`)).toBeInTheDocument();
    expect(document.querySelector('[data-idb-originals-close]')).not.toBeNull();
  });

  it('shows the offline toast and returns to ready when the helper cannot be reached', async () => {
    installFetch((url) => {
      if (url.endsWith('/health')) {
        return helperHealth(null);
      }

      return Promise.reject(new TypeError('fetch failed'));
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await renderReady();
      await fireEvent.click(getSocialCheckbox());
      await fireEvent.input(getOutInput(), { target: { value: String.raw`C:\social` } });

      await fireEvent.click(getDownloadNow());

      await waitFor(() => {
        expect(dangerSpy).toHaveBeenCalledWith('Local helper not running — start `npm run social` on the host');
      });
      expect(document.querySelector('[data-idb-originals-ready]')).not.toBeNull();
      expect(document.querySelector('[data-idb-originals-social-progress]')).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('exports the social block when the tickbox is ticked', async () => {
    await renderReady();
    await fireEvent.click(getSocialCheckbox());

    await fireEvent.click(getExport());

    expect(downloadOriginalsPlan).toHaveBeenCalledTimes(1);
    const [exportedPlan] = vi.mocked(downloadOriginalsPlan).mock.calls[0];
    expect(exportedPlan.social).toEqual({ enabled: true, maxDimension: IDB_ORIGINALS_SOCIAL_MAX_DIMENSION });
    expect(exportedPlan.social).toEqual({ enabled: true, maxDimension: 1080 });
  });

  it('omits the social block when the tickbox stays off or is unticked', async () => {
    await renderReady();
    await fireEvent.click(getSocialCheckbox());
    await fireEvent.click(getSocialCheckbox());

    await fireEvent.click(getExport());

    expect(downloadOriginalsPlan).toHaveBeenCalledTimes(1);
    const [exportedPlan] = vi.mocked(downloadOriginalsPlan).mock.calls[0];
    expect(exportedPlan).not.toHaveProperty('social');
  });
});
