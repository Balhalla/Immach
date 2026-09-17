import { basenameOf, buildDownloadUrl, buildImageUrl, buildViewUrl, extractDriveId, resolveDriveId, resolveDriveIdWithOverrides } from '$lib/utils/idb-drive';
import { getDriveIdOverride } from '$lib/utils/idb-drive-overrides';

vitest.mock('$lib/utils/idb-drive-overrides', () => ({
  getDriveIdOverride: vitest.fn(),
}));

const ID = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub';
const AMBIGUOUS_ID = '1-DaR2__OWznpm-CziZdovEenUlegxvht';
const AMBIGUOUS_FILE = `DSC08618__${AMBIGUOUS_ID}.jpg`;

describe('idb-drive', () => {
  beforeEach(() => {
    vitest.mocked(getDriveIdOverride).mockReset();
    vitest.mocked(getDriveIdOverride).mockResolvedValue(null);
  });

  describe('extractDriveId', () => {
    it('extracts the trailing id from a mirror filename', () => {
      expect(extractDriveId(`DSC03022__${ID}.jpg`)).toBe(ID);
    });

    it('recovers ids that themselves contain a double underscore (rightmost valid segment)', () => {
      expect(extractDriveId('_MG_1416__19y1McvkvvEBw_ESSrhn_tMgi0p0lN__2.jpg')).toBe(
        '19y1McvkvvEBw_ESSrhn_tMgi0p0lN__2',
      );
    });

    it('skips right-hand segments that are too short', () => {
      expect(extractDriveId('vacation__2021__DSC03022.jpg')).toBeNull();
      expect(extractDriveId(`stem__short__${ID}.jpg`)).toBe(ID);
    });

    it('returns null when no separator exists and the stem is not an id', () => {
      expect(extractDriveId('DSC03022.jpg')).toBeNull();
      expect(extractDriveId('a__b.jpg')).toBeNull();
    });

    it('tests a separator-free stem whole', () => {
      expect(extractDriveId('this-stem-is-long-enough-to-pass.jpg')).toBe('this-stem-is-long-enough-to-pass');
    });

    it('returns null for empty input', () => {
      expect(extractDriveId('')).toBeNull();
    });
  });

  describe('resolveDriveId', () => {
    it('prefers the original file name', () => {
      expect(resolveDriveId({ originalFileName: `a__${ID}.jpg`, originalPath: '/library/other.jpg' })).toBe(ID);
    });

    it('falls back to the basename of originalPath', () => {
      expect(resolveDriveId({ originalFileName: 'a.jpg', originalPath: String.raw`C:\mirror\2021\b__${ID}.jpg` })).toBe(
        ID,
      );
      expect(resolveDriveId({ originalFileName: 'a.jpg', originalPath: `/mnt/mirror/2021/b__${ID}.jpg` })).toBe(ID);
    });

    it('returns null when neither name resolves', () => {
      expect(resolveDriveId({ originalFileName: 'a.jpg', originalPath: '/mnt/mirror/2021/b.jpg' })).toBeNull();
    });
  });

  describe('resolveDriveIdWithOverrides', () => {
    it('prefers a file-name override over the (truncating) parser result', async () => {
      vitest.mocked(getDriveIdOverride).mockResolvedValue(AMBIGUOUS_ID);

      await expect(
        resolveDriveIdWithOverrides({ originalFileName: AMBIGUOUS_FILE, originalPath: '/library/other.jpg' }),
      ).resolves.toBe(AMBIGUOUS_ID);
      expect(getDriveIdOverride).toHaveBeenCalledWith(AMBIGUOUS_FILE);
    });

    it('prefers a path-basename override when the file name has none', async () => {
      vitest.mocked(getDriveIdOverride).mockImplementation((fileName) =>
        Promise.resolve(fileName === `mirror__${AMBIGUOUS_ID}.jpg` ? AMBIGUOUS_ID : null),
      );

      await expect(
        resolveDriveIdWithOverrides({
          originalFileName: 'a.jpg',
          originalPath: `C:\\mirror\\2026\\mirror__${AMBIGUOUS_ID}.jpg`,
        }),
      ).resolves.toBe(AMBIGUOUS_ID);
    });

    it('falls back to the parser when the override map has no match', async () => {
      await expect(
        resolveDriveIdWithOverrides({ originalFileName: `a__${ID}.jpg`, originalPath: '/library/other.jpg' }),
      ).resolves.toBe(ID);
      await expect(
        resolveDriveIdWithOverrides({ originalFileName: 'a.jpg', originalPath: `/mnt/mirror/2021/b__${ID}.jpg` }),
      ).resolves.toBe(ID);
    });

    it('returns null when neither overrides nor parser resolve', async () => {
      await expect(
        resolveDriveIdWithOverrides({ originalFileName: 'a.jpg', originalPath: '/mnt/mirror/2021/b.jpg' }),
      ).resolves.toBeNull();
    });
  });

  describe('basenameOf', () => {
    it('handles windows, posix and bare names', () => {
      expect(basenameOf(String.raw`C:\mirror\2026\a.jpg`)).toBe('a.jpg');
      expect(basenameOf('/mnt/mirror/2026/a.jpg')).toBe('a.jpg');
      expect(basenameOf('a.jpg')).toBe('a.jpg');
      expect(basenameOf('')).toBe('');
    });
  });

  describe('link builders', () => {
    it('builds the Drive view url', () => {
      expect(buildViewUrl(ID)).toBe(`https://drive.google.com/file/d/${ID}/view`);
    });

    it('builds the Drive download url', () => {
      expect(buildDownloadUrl(ID)).toBe(
        `https://drive.usercontent.google.com/download?id=${ID}&export=download&confirm=t`,
      );
    });

    it('builds the Drive thumbnail url', () => {
      expect(buildImageUrl(ID)).toBe(`https://drive.google.com/thumbnail?id=${ID}&sz=w1000`);
    });
  });
});
