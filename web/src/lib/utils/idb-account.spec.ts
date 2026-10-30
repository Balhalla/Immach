import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EMAIL = 'michael.coene@balhalla.be';

const FIXTURE = {
  schemaVersion: 1,
  authuser: EMAIL,
};

const responseFor = (body: unknown, status = 200) => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
};

const stubFetch = (body: unknown, status = 200) => {
  const fetchMock = vi.fn(() => Promise.resolve(responseFor(body, status)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const importIdbAccount = () => import('$lib/utils/idb-account');

describe('idb-account', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches the map lazily, caches it and exposes the authuser', async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { ensureAccountLoaded, getCachedAuthuser } = await importIdbAccount();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCachedAuthuser()).toBe('');

    await ensureAccountLoaded();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/idb-account.json');
    expect(getCachedAuthuser()).toBe(EMAIL);

    await ensureAccountLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns the feature off when the file is missing (404)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(null, 404);

    const { ensureAccountLoaded, getCachedAuthuser } = await importIdbAccount();
    await expect(ensureAccountLoaded()).resolves.toBeUndefined();
    expect(getCachedAuthuser()).toBe('');

    expect(debugSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('turns the feature off when the fetch fails', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);

    const { getCachedAuthuser, ensureAccountLoaded } = await importIdbAccount();
    await ensureAccountLoaded();
    expect(getCachedAuthuser()).toBe('');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('turns the feature off when the body is not valid json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('unexpected token')),
        }),
      ),
    );

    const { getCachedAuthuser, ensureAccountLoaded } = await importIdbAccount();
    await ensureAccountLoaded();
    expect(getCachedAuthuser()).toBe('');
  });

  it('turns the feature off for an unsupported schema version', async () => {
    stubFetch({ ...FIXTURE, schemaVersion: 2 });

    const { getCachedAuthuser, ensureAccountLoaded } = await importIdbAccount();
    await ensureAccountLoaded();
    expect(getCachedAuthuser()).toBe('');
  });

  it('turns the feature off when authuser is malformed', async () => {
    for (const authuser of [undefined, null, '', 3, { a: 1 }]) {
      vi.resetModules();
      stubFetch({ ...FIXTURE, authuser });
      const { getCachedAuthuser, ensureAccountLoaded } = await importIdbAccount();
      await ensureAccountLoaded();
      expect(getCachedAuthuser()).toBe('');
      vi.unstubAllGlobals();
    }
  });
});
