const CLEAN_ID = 'cleanDriveId000000000000000001';
const WATERMARK_A = 'watermarkDriveId000000000001A' as string;
const WATERMARK_B = 'watermarkDriveId000000000001B' as string;
const OTHER_ID = 'otherDriveId0000000000000000001';

const FIXTURE = {
  schemaVersion: 1,
  generatedAt: '2026-09-17T00:00:00.000Z',
  variants: [
    {
      cleanDriveId: CLEAN_ID,
      cleanName: 'DSC03022.jpg',
      watermarkDriveIds: [WATERMARK_A, WATERMARK_B],
      match: 'met-zonder',
      confidence: 'high',
      driveFolder: '2026/02/25 Wednesday/Johan Zonder logo',
    },
  ],
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

const importIdbVariants = () => import('$lib/utils/idb-variants');

describe('idb-variants', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches the map lazily, caches it and resolves the clean drive id', async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { getVariantEntry } = await importIdbVariants();

    expect(fetchMock).not.toHaveBeenCalled();

    const entry = await getVariantEntry(CLEAN_ID);
    expect(entry).toMatchObject({
      cleanDriveId: CLEAN_ID,
      cleanName: 'DSC03022.jpg',
      match: 'met-zonder',
      confidence: 'high',
    });
    expect(entry?.watermarkDriveIds).toStrictEqual([WATERMARK_A, WATERMARK_B]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getVariantEntry(WATERMARK_A);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves watermark drive ids to the same variant entry', async () => {
    stubFetch(FIXTURE);
    const { getVariantEntry } = await importIdbVariants();

    await expect(getVariantEntry(WATERMARK_A)).resolves.toMatchObject({ cleanDriveId: CLEAN_ID });
    await expect(getVariantEntry(WATERMARK_B)).resolves.toMatchObject({ cleanDriveId: CLEAN_ID });
  });

  it('returns the clean id plus the first watermark id as the download choice', async () => {
    stubFetch(FIXTURE);
    const { getVariantDownloadChoice } = await importIdbVariants();

    await expect(getVariantDownloadChoice(CLEAN_ID)).resolves.toStrictEqual({
      cleanDriveId: CLEAN_ID,
      watermarkDriveId: WATERMARK_A,
    });
    await expect(getVariantDownloadChoice(WATERMARK_B)).resolves.toStrictEqual({
      cleanDriveId: CLEAN_ID,
      watermarkDriveId: WATERMARK_A,
    });
  });

  it('returns null for unknown and missing drive ids without refetching', async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { getVariantEntry, getVariantDownloadChoice } = await importIdbVariants();

    await expect(getVariantEntry(OTHER_ID)).resolves.toBeNull();
    await expect(getVariantDownloadChoice(OTHER_ID)).resolves.toBeNull();
    await expect(getVariantEntry(null)).resolves.toBeNull();
    await expect(getVariantDownloadChoice(undefined)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a choice without a watermark id when the entry has no twin', async () => {
    stubFetch({
      ...FIXTURE,
      variants: [{ ...FIXTURE.variants[0], watermarkDriveIds: [] }],
    });
    const { getVariantDownloadChoice } = await importIdbVariants();

    await expect(getVariantDownloadChoice(CLEAN_ID)).resolves.toStrictEqual({
      cleanDriveId: CLEAN_ID,
      watermarkDriveId: undefined,
    });
  });

  it('turns the feature off when the map is missing (404)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(null, 404);

    const { getVariantEntry, getVariantDownloadChoice } = await importIdbVariants();
    await expect(getVariantEntry(CLEAN_ID)).resolves.toBeNull();
    await expect(getVariantDownloadChoice(CLEAN_ID)).resolves.toBeNull();

    expect(debugSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('turns the feature off when the fetch fails', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);

    const { getVariantEntry } = await importIdbVariants();
    await expect(getVariantEntry(CLEAN_ID)).resolves.toBeNull();
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

    const { getVariantEntry } = await importIdbVariants();
    await expect(getVariantEntry(CLEAN_ID)).resolves.toBeNull();
  });

  it('turns the feature off for an unsupported schema version', async () => {
    stubFetch({ ...FIXTURE, schemaVersion: 2 });

    const { getVariantEntry } = await importIdbVariants();
    await expect(getVariantEntry(CLEAN_ID)).resolves.toBeNull();
  });

  it('turns the feature off when an entry is malformed', async () => {
    stubFetch({
      ...FIXTURE,
      variants: [{ ...FIXTURE.variants[0], watermarkDriveIds: 'not-an-array' }],
    });

    const { getVariantEntry } = await importIdbVariants();
    await expect(getVariantEntry(CLEAN_ID)).resolves.toBeNull();
  });
});
