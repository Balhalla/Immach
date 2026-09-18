import { persisted } from 'svelte-persisted-store';
import { SvelteSet } from 'svelte/reactivity';
import { searchManager } from '$lib/managers/search-manager.svelte';
import type { TagMatchMode } from '$lib/types';
import { isTagMatchMode } from '$lib/utils/tag-search';

export const SAVED_TAG_COMBOS_KEY = 'idb-saved-tag-combos';
export const SAVED_TAG_COMBOS_VERSION = 1;

export interface SavedTagCombo {
  id: string;
  name: string;
  tagIds: string[];
  match: TagMatchMode;
}

export interface SavedTagCombosState {
  version: number;
  combos: SavedTagCombo[];
}

export const emptySavedTagCombos = (): SavedTagCombosState => ({
  version: SAVED_TAG_COMBOS_VERSION,
  combos: [],
});

export const normalizeSavedTagCombo = (value: unknown): SavedTagCombo | undefined => {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0 || typeof record.name !== 'string') {
    return undefined;
  }
  if (!Array.isArray(record.tagIds)) {
    return undefined;
  }

  const tagIds = [
    ...new Set(record.tagIds.filter((tagId): tagId is string => typeof tagId === 'string' && tagId.length > 0)),
  ];
  if (tagIds.length === 0) {
    return undefined;
  }

  return {
    id: record.id,
    name: record.name.trim(),
    tagIds,
    match: isTagMatchMode(record.match) ? record.match : 'all',
  };
};

export const normalizeSavedTagCombos = (value: unknown): SavedTagCombosState => {
  if (value === null || typeof value !== 'object') {
    return emptySavedTagCombos();
  }

  const record = value as Record<string, unknown>;
  if (record.version !== SAVED_TAG_COMBOS_VERSION || !Array.isArray(record.combos)) {
    return emptySavedTagCombos();
  }

  const combos = record.combos
    .map((combo) => normalizeSavedTagCombo(combo))
    .filter((combo): combo is SavedTagCombo => combo !== undefined);

  return { version: SAVED_TAG_COMBOS_VERSION, combos };
};

export const parseSavedTagCombos = (text: string | null): SavedTagCombosState => {
  try {
    return normalizeSavedTagCombos(text === null ? undefined : JSON.parse(text));
  } catch {
    return emptySavedTagCombos();
  }
};

export const serializeSavedTagCombos = (state: SavedTagCombosState): string => JSON.stringify(state);

export const savedTagCombos = persisted<SavedTagCombosState>(SAVED_TAG_COMBOS_KEY, emptySavedTagCombos(), {
  serializer: { parse: parseSavedTagCombos, stringify: serializeSavedTagCombos },
});

let comboCounter = 0;

export const createSavedTagComboId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  comboCounter++;
  return `combo-${Date.now().toString(36)}-${comboCounter}`;
};

export const saveTagCombo = (name: string, tagIds: string[], match: TagMatchMode = 'all') => {
  const trimmedName = name.trim();
  const uniqueTagIds = [...new Set(tagIds)];
  if (trimmedName.length === 0 || uniqueTagIds.length === 0) {
    return undefined;
  }

  const combo: SavedTagCombo = {
    id: createSavedTagComboId(),
    name: trimmedName,
    tagIds: uniqueTagIds,
    match,
  };
  savedTagCombos.update((state) => ({
    version: SAVED_TAG_COMBOS_VERSION,
    combos: [...state.combos, combo],
  }));
  return combo;
};

export const deleteTagCombo = (id: string) => {
  savedTagCombos.update((state) => ({
    version: SAVED_TAG_COMBOS_VERSION,
    combos: state.combos.filter((combo) => combo.id !== id),
  }));
};

export const applyTagCombo = async (combo: SavedTagCombo) => {
  searchManager.reset();
  searchManager.filter.tagIds = new SvelteSet(combo.tagIds);
  searchManager.filter.tagMatch = combo.match;
  await searchManager.submit();
};
