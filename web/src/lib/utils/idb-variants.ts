export const IDB_VARIANTS_URL = '/idb-variants.json';
export const IDB_VARIANTS_SCHEMA_VERSION = 1;

export type IdbVariantMatch = 'met-zonder' | 'aangepast' | 'identical';
export type IdbVariantConfidence = 'high' | 'medium';

export type IdbVariantEntry = {
  cleanDriveId: string;
  cleanName: string;
  watermarkDriveIds: string[];
  match: IdbVariantMatch;
  confidence: IdbVariantConfidence;
  driveFolder: string;
};

export type IdbVariantsMap = {
  schemaVersion: typeof IDB_VARIANTS_SCHEMA_VERSION;
  generatedAt: string;
  variants: IdbVariantEntry[];
};

export type IdbVariantDownloadChoice = {
  cleanDriveId: string;
  watermarkDriveId?: string;
};

const MATCHES = new Set<string>(['met-zonder', 'aangepast', 'identical']);
const CONFIDENCES = new Set<string>(['high', 'medium']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isIdbVariantEntry = (value: unknown): value is IdbVariantEntry => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.cleanDriveId === 'string' &&
    value.cleanDriveId.length > 0 &&
    typeof value.cleanName === 'string' &&
    Array.isArray(value.watermarkDriveIds) &&
    value.watermarkDriveIds.every((id) => typeof id === 'string' && id.length > 0) &&
    typeof value.match === 'string' &&
    MATCHES.has(value.match) &&
    typeof value.confidence === 'string' &&
    CONFIDENCES.has(value.confidence) &&
    typeof value.driveFolder === 'string'
  );
};

const parseIdbVariantsMap = (value: unknown): IdbVariantsMap | null => {
  if (!isRecord(value) || value.schemaVersion !== IDB_VARIANTS_SCHEMA_VERSION || !Array.isArray(value.variants)) {
    return null;
  }

  const { generatedAt, variants } = value;
  if (typeof generatedAt !== 'string' || variants.some((entry) => !isIdbVariantEntry(entry))) {
    return null;
  }

  return {
    schemaVersion: IDB_VARIANTS_SCHEMA_VERSION,
    generatedAt,
    variants: variants as IdbVariantEntry[],
  };
};

class IdbVariantsStore {
  #entryByDriveId = new Map<string, IdbVariantEntry>();
  #loadPromise: Promise<void> | undefined;

  ensureLoaded(): Promise<void> {
    this.#loadPromise ??= this.#load();
    return this.#loadPromise;
  }

  async getEntry(driveId: string | null | undefined): Promise<IdbVariantEntry | null> {
    if (!driveId) {
      return null;
    }

    await this.ensureLoaded();
    return this.#entryByDriveId.get(driveId) ?? null;
  }

  async getDownloadChoice(driveId: string | null | undefined): Promise<IdbVariantDownloadChoice | null> {
    const entry = await this.getEntry(driveId);
    if (!entry) {
      return null;
    }

    return { cleanDriveId: entry.cleanDriveId, watermarkDriveId: entry.watermarkDriveIds[0] };
  }

  async #load(): Promise<void> {
    try {
      const response = await fetch(IDB_VARIANTS_URL);
      if (!response.ok) {
        throw new Error(`unexpected status ${response.status}`);
      }

      const map = parseIdbVariantsMap(await response.json());
      if (!map) {
        throw new Error(`unrecognized ${IDB_VARIANTS_URL} schema`);
      }

      this.#index(map);
      console.debug(`[idb] watermark variants loaded: ${map.variants.length} entries`);
    } catch (error) {
      console.debug('[idb] watermark variants unavailable, download chooser disabled', error);
    }
  }

  #index(map: IdbVariantsMap): void {
    const entryByDriveId = new Map<string, IdbVariantEntry>();
    for (const entry of map.variants) {
      if (!entryByDriveId.has(entry.cleanDriveId)) {
        entryByDriveId.set(entry.cleanDriveId, entry);
      }

      for (const watermarkDriveId of entry.watermarkDriveIds) {
        if (!entryByDriveId.has(watermarkDriveId)) {
          entryByDriveId.set(watermarkDriveId, entry);
        }
      }
    }

    this.#entryByDriveId = entryByDriveId;
  }
}

export const idbVariants = new IdbVariantsStore();

export const getVariantEntry = (driveId: string | null | undefined): Promise<IdbVariantEntry | null> => {
  return idbVariants.getEntry(driveId);
};

export const getVariantDownloadChoice = (
  driveId: string | null | undefined,
): Promise<IdbVariantDownloadChoice | null> => {
  return idbVariants.getDownloadChoice(driveId);
};
