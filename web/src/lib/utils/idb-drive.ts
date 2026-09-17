const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

export const extractDriveId = (fileName: string): string | null => {
  if (!fileName) {
    return null;
  }

  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const lastSep = stem.lastIndexOf('__');
  if (lastSep === -1) {
    return DRIVE_ID_PATTERN.test(stem) ? stem : null;
  }

  for (let sep = lastSep; sep >= 0; sep = stem.lastIndexOf('__', sep - 1)) {
    const candidate = stem.slice(sep + 2);
    if (DRIVE_ID_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const resolveDriveId = (asset: { originalFileName: string; originalPath: string }): string | null => {
  const fromFileName = extractDriveId(asset.originalFileName);
  if (fromFileName) {
    return fromFileName;
  }

  const basename = asset.originalPath.replaceAll('\\', '/').split('/').pop() ?? '';
  return extractDriveId(basename);
};

export const buildImageUrl = (driveId: string): string => {
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
};

export const buildViewUrl = (driveId: string): string => {
  return `https://drive.google.com/file/d/${driveId}/view`;
};

export const buildDownloadUrl = (driveId: string): string => {
  return `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
};
