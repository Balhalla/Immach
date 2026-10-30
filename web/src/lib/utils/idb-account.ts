export const IDB_ACCOUNT_URL = '/idb-account.json';
export const IDB_ACCOUNT_SCHEMA_VERSION = 1;

export type IdbAccountMap = {
  schemaVersion: typeof IDB_ACCOUNT_SCHEMA_VERSION;
  authuser: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseIdbAccountMap = (value: unknown): IdbAccountMap | null => {
  if (!isRecord(value) || value.schemaVersion !== IDB_ACCOUNT_SCHEMA_VERSION) {
    return null;
  }

  const { authuser } = value;
  if (typeof authuser !== 'string' || authuser.length === 0) {
    return null;
  }

  return {
    schemaVersion: IDB_ACCOUNT_SCHEMA_VERSION,
    authuser,
  };
};

/**
 * The Google account email the Drive links must be pinned to via `authuser=`. The originals live in
 * one account's Drive; without the pin Google's download/view endpoints use the browser's default
 * account and answer 403 ("Je hebt geen toegang") when several Google accounts are signed in.
 * Generated next to the build (synced from .env.local DRIVE_ACCOUNT_EMAIL); a missing/invalid file
 * turns pinning off (links stay unchanged), never blocks a download.
 */
class IdbAccountStore {
  #authuser = '';
  #loadPromise: Promise<void> | undefined;

  ensureLoaded(): Promise<void> {
    this.#loadPromise ??= this.#load();
    return this.#loadPromise;
  }

  getCached(): string {
    return this.#authuser;
  }

  async #load(): Promise<void> {
    try {
      const response = await fetch(IDB_ACCOUNT_URL);
      if (!response.ok) {
        throw new Error(`unexpected status ${response.status}`);
      }

      const map = parseIdbAccountMap(await response.json());
      if (!map) {
        throw new Error(`unrecognized ${IDB_ACCOUNT_URL} schema`);
      }

      this.#authuser = map.authuser;
      console.debug('[idb] drive account authuser pinned');
    } catch (error) {
      console.debug('[idb] drive account unavailable, Drive links will not pin authuser', error);
    }
  }
}

const idbAccount = new IdbAccountStore();

export const ensureAccountLoaded = (): Promise<void> => idbAccount.ensureLoaded();

/** Synchronous access to the cached account (empty until {@link ensureAccountLoaded} resolves). */
export const getCachedAuthuser = (): string => idbAccount.getCached();
