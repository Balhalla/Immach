const FULL_ID = '1-DaR2__OWznpm-CziZdovEenUlegxvht';
const FILE_NAME = `20260227-{@-JohanWijchen}-DSC08618__${FULL_ID}.jpg`;

const FIXTURE = {
  schemaVersion: 1,
  generatedAt: '2026-09-17T18:00:57.229Z',
  overrides: {
    [FILE_NAME]: FULL_ID,
    'Balhalla-4025__1__knhWEB5vvckmffNCLEvpha-X_biL5-.jpg': '1__knhWEB5vvckmffNCLEvpha-X_biL5-',
  },
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

const importIdbDriveOverrides = () => import('$lib/utils/idb-drive-overrides');

describe('idb-drive-overrides', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches the map lazily, caches it and resolves an overridden filename', async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { getDriveIdOverride } = await importIdbDriveOverrides();

    expect(fetchMock).not.toHaveBeenCalled();

    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBe(FULL_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/idb-drive-overrides.json');

    await getDriveIdOverride(FILE_NAME);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for unknown, empty and missing file names without refetching', async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { getDriveIdOverride } = await importIdbDriveOverrides();

    await expect(getDriveIdOverride('DSC03022__10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub.jpg')).resolves.toBeNull();
    await expect(getDriveIdOverride('')).resolves.toBeNull();
    await expect(getDriveIdOverride(null)).resolves.toBeNull();
    await expect(getDriveIdOverride(undefined)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('matches file names exactly (case-sensitive)', async () => {
    stubFetch(FIXTURE);
    const { getDriveIdOverride } = await importIdbDriveOverrides();

    await expect(getDriveIdOverride(FILE_NAME.toUpperCase())).resolves.toBeNull();
  });

  it('turns the feature off when the map is missing (404)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(null, 404);

    const { getDriveIdOverride, ensureDriveIdOverridesLoaded } = await importIdbDriveOverrides();
    await expect(ensureDriveIdOverridesLoaded()).resolves.toBeUndefined();
    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();

    expect(debugSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('turns the feature off when the fetch fails', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);

    const { getDriveIdOverride } = await importIdbDriveOverrides();
    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();
    expect(debugSpy).toHaveBeenCalled();
  });

  it('turns the feature off when the body is not valid json', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('unexpected token')),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getDriveIdOverride } = await importIdbDriveOverrides();
    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();
  });

  it('turns the feature off for an unsupported schema version', async () => {
    stubFetch({ ...FIXTURE, schemaVersion: 2 });

    const { getDriveIdOverride } = await importIdbDriveOverrides();
    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();
  });

  it('turns the feature off when overrides are malformed', async () => {
    for (const overrides of ['not-an-object', [], { [FILE_NAME]: '' }, { '': FULL_ID }, { [FILE_NAME]: 3 }]) {
      vi.resetModules();
      stubFetch({ ...FIXTURE, overrides });
      const { getDriveIdOverride } = await importIdbDriveOverrides();
      await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();
      vi.unstubAllGlobals();
    }
  });

  it('turns the feature off when generatedAt is not a string', async () => {
    stubFetch({ ...FIXTURE, generatedAt: 3 });

    const { getDriveIdOverride } = await importIdbDriveOverrides();
    await expect(getDriveIdOverride(FILE_NAME)).resolves.toBeNull();
  });
});
