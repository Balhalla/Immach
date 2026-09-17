import { getAssetInfo } from '@immich/sdk';
import { modalManager, toastManager } from '@immich/ui';
import { vitest } from 'vitest';
import { authManager } from '$lib/managers/auth-manager.svelte';
import WatermarkDownloadChooserModal from '$lib/modals/WatermarkDownloadChooserModal.svelte';
import { getAssetActions, handleDownloadAsset } from '$lib/services/asset.service';
import { setSharedLink } from '$lib/utils';
import { getFormatter } from '$lib/utils/i18n';
import { getVariantDownloadChoice, getVariantEntry, type IdbVariantEntry } from '$lib/utils/idb-variants';
import { getDriveIdOverride } from '$lib/utils/idb-drive-overrides';
import { assetFactory } from '@test-data/factories/asset-factory';
import { preferencesFactory } from '@test-data/factories/preferences-factory';
import { sharedLinkFactory } from '@test-data/factories/shared-link-factory';
import { userAdminFactory } from '@test-data/factories/user-factory';

vitest.mock('@immich/ui', () => ({
  modalManager: {
    show: vitest.fn(),
  },
  toastManager: {
    primary: vitest.fn(),
  },
}));

vitest.mock('$lib/utils/idb-variants', () => ({
  getVariantDownloadChoice: vitest.fn(),
  getVariantEntry: vitest.fn(),
}));

vitest.mock('$lib/utils/idb-drive-overrides', () => ({
  getDriveIdOverride: vitest.fn(),
  ensureDriveIdOverridesLoaded: vitest.fn(),
}));

vitest.mock('$lib/utils/i18n', () => ({
  getFormatter: vitest.fn(),
  getPreferredLocale: vitest.fn(),
}));

vitest.mock('@immich/sdk');

vitest.mock('$lib/utils', async () => {
  const originalModule = await vitest.importActual('$lib/utils');
  return {
    ...originalModule,
    sleep: vitest.fn(),
  };
});

vi.mock(import('$lib/managers/feature-flags-manager.svelte'), function () {
  return {
    featureFlagsManager: { init: vi.fn(), loadFeatureFlags: vi.fn(), value: {} } as never,
  };
});

const variantEntry = (cleanDriveId: string, watermarkDriveIds: string[] = []): IdbVariantEntry => {
  return {
    cleanDriveId,
    cleanName: 'DSC03022.jpg',
    watermarkDriveIds,
    match: 'met-zonder',
    confidence: 'high',
    driveFolder: '2026/02/25 Wednesday/Johan Met Logo',
  };
};

describe('AssetService', () => {
  describe('getAssetActions', () => {
    beforeEach(() => {
      vitest.clearAllMocks();
      authManager.setPreferences(preferencesFactory.build());
      vitest.mocked(getVariantEntry).mockResolvedValue(null);
      vitest.mocked(getVariantDownloadChoice).mockResolvedValue(null);
      vitest.mocked(getDriveIdOverride).mockResolvedValue(null);
    });

    it('should allow shared link downloads if the user owns the asset and shared link downloads are disabled', () => {
      const ownerId = 'owner';
      const user = userAdminFactory.build({ id: ownerId });
      const asset = assetFactory.build({ ownerId });
      authManager.setUser(user);
      setSharedLink(sharedLinkFactory.build({ allowDownload: false }));
      const assetActions = getAssetActions(() => '', asset);
      expect(assetActions.SharedLinkDownload.$if?.()).toStrictEqual(true);
    });

    it('should not allow shared link downloads if the user does not own the asset and shared link downloads are disabled', () => {
      const ownerId = 'owner';
      const user = userAdminFactory.build({ id: 'non-owner' });
      const asset = assetFactory.build({ ownerId });
      authManager.setUser(user);
      setSharedLink(sharedLinkFactory.build({ allowDownload: false }));
      const assetActions = getAssetActions(() => '', asset);
      expect(assetActions.SharedLinkDownload.$if?.()).toStrictEqual(false);
    });

    it('should allow shared link downloads if shared link downloads are enabled regardless of user', () => {
      const asset = assetFactory.build();
      setSharedLink(sharedLinkFactory.build({ allowDownload: true }));
      const assetActions = getAssetActions(() => '', asset);
      expect(assetActions.SharedLinkDownload.$if?.()).toStrictEqual(true);
    });

    it('should expose the Drive original action only when the filename carries an embedded Drive id', () => {
      const driveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub';
      const resolved = assetFactory.build({
        originalFileName: `DSC03022__${driveId}.jpg`,
        originalPath: '/library/DSC03022.jpg',
      });
      const unresolved = assetFactory.build({
        originalFileName: 'DSC03022.jpg',
        originalPath: '/library/DSC03022.jpg',
      });

      expect(getAssetActions(() => '', resolved).OpenDriveOriginal.$if?.()).toStrictEqual(true);
      expect(getAssetActions(() => '', unresolved).OpenDriveOriginal.$if?.()).toStrictEqual(false);
    });

    it('should open the Drive view url from the Drive original action', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const driveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub';
      const asset = assetFactory.build({ originalFileName: `DSC03022__${driveId}.jpg` });

      await getAssetActions(() => '', asset).OpenDriveOriginal.onAction({} as never);

      expect(open).toHaveBeenCalledWith(`https://drive.google.com/file/d/${driveId}/view`, '_blank');
      open.mockRestore();
    });

    it('should open the clean Drive view url when the asset is a watermarked twin', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const cleanDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xClean';
      const watermarkDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xWater';
      vitest.mocked(getVariantEntry).mockResolvedValue(variantEntry(cleanDriveId, [watermarkDriveId]));
      const asset = assetFactory.build({ originalFileName: `DSC03022__${watermarkDriveId}.jpg` });

      await getAssetActions(() => '', asset).OpenDriveOriginal.onAction({} as never);

      expect(open).toHaveBeenCalledWith(`https://drive.google.com/file/d/${cleanDriveId}/view`, '_blank');
      open.mockRestore();
    });

    it('should open the drive-id override (full id) instead of the truncated parser id', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const fullDriveId = '1-DaR2__OWznpm-CziZdovEenUlegxvht';
      const fileName = `DSC08618__${fullDriveId}.jpg`;
      vitest.mocked(getDriveIdOverride).mockImplementation((name) =>
        Promise.resolve(name === fileName ? fullDriveId : null),
      );
      const asset = assetFactory.build({ originalFileName: fileName, originalPath: '/library/other.jpg' });

      await getAssetActions(() => '', asset).OpenDriveOriginal.onAction({} as never);

      expect(open).toHaveBeenCalledWith(`https://drive.google.com/file/d/${fullDriveId}/view`, '_blank');
      open.mockRestore();
    });

    it('should download the drive-id override (full id) instead of the truncated parser id', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const fullDriveId = '1__knhWEB5vvckmffNCLEvpha-X_biL5-';
      const fileName = `Balhalla-4025__${fullDriveId}.jpg`;
      vitest.mocked(getDriveIdOverride).mockImplementation((name) =>
        Promise.resolve(name === fileName ? fullDriveId : null),
      );
      const asset = assetFactory.build({ originalFileName: fileName, originalPath: '/library/other.jpg' });

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(open).toHaveBeenCalledWith(
        `https://drive.usercontent.google.com/download?id=${fullDriveId}&export=download&confirm=t`,
        '_blank',
      );
      open.mockRestore();
    });

    it('should open the Drive download url from the Download action when resolved', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const driveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xKub';
      const asset = assetFactory.build({ originalFileName: `DSC03022__${driveId}.jpg` });
      authManager.setUser(userAdminFactory.build({ id: asset.ownerId }));

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(modalManager.show).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledWith(
        `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
        '_blank',
      );
      open.mockRestore();
    });

    it('should download the clean id directly when the variant entry has no watermark twin', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const cleanDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xClean';
      vitest.mocked(getVariantDownloadChoice).mockResolvedValue({ cleanDriveId, watermarkDriveId: undefined });
      const asset = assetFactory.build({ originalFileName: `DSC03022__${cleanDriveId}.jpg` });

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(modalManager.show).not.toHaveBeenCalled();
      expect(open).toHaveBeenCalledWith(
        `https://drive.usercontent.google.com/download?id=${cleanDriveId}&export=download&confirm=t`,
        '_blank',
      );
      open.mockRestore();
    });

    it('should show the watermark chooser and download the clean version when it is chosen', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const cleanDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xClean';
      const watermarkDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xWater';
      vitest.mocked(getVariantDownloadChoice).mockResolvedValue({ cleanDriveId, watermarkDriveId });
      vitest.mocked(modalManager.show).mockResolvedValue('clean' as never);
      const asset = assetFactory.build({ originalFileName: `DSC03022__${watermarkDriveId}.jpg` });

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(modalManager.show).toHaveBeenCalledWith(WatermarkDownloadChooserModal, {});
      expect(open).toHaveBeenCalledWith(
        `https://drive.usercontent.google.com/download?id=${cleanDriveId}&export=download&confirm=t`,
        '_blank',
      );
      open.mockRestore();
    });

    it('should download the watermarked version when it is chosen', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const cleanDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xClean';
      const watermarkDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xWater';
      vitest.mocked(getVariantDownloadChoice).mockResolvedValue({ cleanDriveId, watermarkDriveId });
      vitest.mocked(modalManager.show).mockResolvedValue('watermark' as never);
      const asset = assetFactory.build({ originalFileName: `DSC03022__${cleanDriveId}.jpg` });

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(open).toHaveBeenCalledWith(
        `https://drive.usercontent.google.com/download?id=${watermarkDriveId}&export=download&confirm=t`,
        '_blank',
      );
      open.mockRestore();
    });

    it('should not download anything when the watermark chooser is dismissed', async () => {
      const open = vitest.spyOn(globalThis, 'open').mockImplementation(() => null);
      const cleanDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xClean';
      const watermarkDriveId = '10ZDTXXVtIe--_ucLSVDsvmbCfmZ-xWater';
      vitest.mocked(getVariantDownloadChoice).mockResolvedValue({ cleanDriveId, watermarkDriveId });
      vitest.mocked(modalManager.show).mockResolvedValue(undefined as never);
      const asset = assetFactory.build({ originalFileName: `DSC03022__${watermarkDriveId}.jpg` });

      await getAssetActions(() => '', asset).Download.onAction({} as never);

      expect(open).not.toHaveBeenCalled();
      open.mockRestore();
    });
  });

  describe('handleDownloadAsset', () => {
    it('should use the asset originalFileName when showing toasts', async () => {
      const $t = vitest.fn().mockReturnValue('formatter');
      vitest.mocked(getFormatter).mockResolvedValue($t);
      const asset = assetFactory.build({ originalFileName: 'asset.heic' });
      await handleDownloadAsset(asset, { edited: false });
      expect($t).toHaveBeenNthCalledWith(1, 'downloading_asset_filename', { values: { filename: 'asset.heic' } });
      expect(toastManager.primary).toHaveBeenCalledWith('formatter');
    });

    it('should use the motion asset originalFileName when showing toasts', async () => {
      const $t = vitest.fn().mockReturnValue('formatter');
      vitest.mocked(getFormatter).mockResolvedValue($t);
      const motionAsset = assetFactory.build({ originalFileName: 'asset.mov' });
      vitest.mocked(getAssetInfo).mockResolvedValue(motionAsset);
      const asset = assetFactory.build({ originalFileName: 'asset.heic', livePhotoVideoId: '1' });
      await handleDownloadAsset(asset, { edited: false });
      expect($t).toHaveBeenNthCalledWith(1, 'downloading_asset_filename', { values: { filename: 'asset.heic' } });
      expect($t).toHaveBeenNthCalledWith(2, 'downloading_asset_filename', { values: { filename: 'asset-motion.mov' } });
      expect(toastManager.primary).toHaveBeenCalledWith('formatter');
    });
  });
});
