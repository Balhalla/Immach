import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { searchManager } from '$lib/managers/search-manager.svelte';
import {
  SAVED_TAG_COMBOS_KEY,
  SAVED_TAG_COMBOS_VERSION,
  applyTagCombo,
  deleteTagCombo,
  emptySavedTagCombos,
  normalizeSavedTagCombos,
  parseSavedTagCombos,
  saveTagCombo,
  savedTagCombos,
  serializeSavedTagCombos,
} from '$lib/stores/saved-tag-combos.store';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const gotoMock = vi.mocked(goto);

const storedState = () => JSON.parse(localStorage.getItem(SAVED_TAG_COMBOS_KEY) ?? 'null');

const submittedDto = () => {
  const url = gotoMock.mock.calls.at(-1)?.[0] as string;
  const raw = new URL(url, 'http://localhost').searchParams.get('query');
  return raw ? JSON.parse(raw) : {};
};

describe('saved tag combos store', () => {
  beforeEach(() => {
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
    gotoMock.mockClear();
    searchManager.reset();
  });

  afterEach(() => {
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
  });

  it('saves a named combination with deduplicated tags and the match mode', () => {
    const combo = saveTagCombo('  Balhalla 2026  ', ['tag-1', 'tag-1', 'tag-2'], 'all');

    expect(combo).toBeDefined();
    expect(get(savedTagCombos).combos).toHaveLength(1);
    expect(get(savedTagCombos).combos[0]).toMatchObject({
      name: 'Balhalla 2026',
      tagIds: ['tag-1', 'tag-2'],
      match: 'all',
    });
    expect(storedState()).toMatchObject({
      version: SAVED_TAG_COMBOS_VERSION,
      combos: [{ id: combo!.id, name: 'Balhalla 2026', tagIds: ['tag-1', 'tag-2'], match: 'all' }],
    });
  });

  it('refuses to save without a name or without tags', () => {
    expect(saveTagCombo(' '.repeat(3), ['tag-1'])).toBeUndefined();
    expect(saveTagCombo('empty', [])).toBeUndefined();
    expect(get(savedTagCombos).combos).toHaveLength(0);
  });

  it('deletes a saved combination from the store and storage', () => {
    const first = saveTagCombo('first', ['tag-1'])!;
    saveTagCombo('second', ['tag-2']);

    deleteTagCombo(first.id);

    expect(get(savedTagCombos).combos.map((combo) => combo.name)).toEqual(['second']);
    expect(storedState().combos).toHaveLength(1);
  });

  it('applies a saved combination through the search URL', async () => {
    const combo = saveTagCombo('Naragonia + Johan', ['tag-1', 'tag-2'], 'any')!;

    await applyTagCombo(combo);

    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(submittedDto()).toMatchObject({ tagIds: ['tag-1', 'tag-2'], tagMatch: 'any' });
    expect([...(searchManager.filter.tagIds ?? [])]).toEqual(['tag-1', 'tag-2']);
    expect(searchManager.filter.tagMatch).toBe('any');
  });

  it('loads persisted combinations when the store is created', async () => {
    localStorage.setItem(
      SAVED_TAG_COMBOS_KEY,
      JSON.stringify({
        version: SAVED_TAG_COMBOS_VERSION,
        combos: [{ id: 'combo-1', name: 'Loaded', tagIds: ['tag-9'], match: 'none' }],
      }),
    );

    vi.resetModules();
    const module = await import('$lib/stores/saved-tag-combos.store');

    expect(get(module.savedTagCombos).combos).toEqual([
      { id: 'combo-1', name: 'Loaded', tagIds: ['tag-9'], match: 'none' },
    ]);
  });

  describe('parsing and versioning', () => {
    it('falls back to an empty state for malformed JSON', () => {
      expect(parseSavedTagCombos('{ not json')).toEqual(emptySavedTagCombos());
      expect(parseSavedTagCombos(null)).toEqual(emptySavedTagCombos());
    });

    it('drops states from unknown versions', () => {
      const validCombo = { id: 'c1', name: 'x', tagIds: ['t1'], match: 'all' };
      expect(normalizeSavedTagCombos({ version: 0, combos: [validCombo] })).toEqual(emptySavedTagCombos());
      expect(normalizeSavedTagCombos({ version: 99, combos: [validCombo] })).toEqual(emptySavedTagCombos());
      expect(normalizeSavedTagCombos({ combos: [validCombo] })).toEqual(emptySavedTagCombos());
      expect(normalizeSavedTagCombos(null)).toEqual(emptySavedTagCombos());
    });

    it('filters malformed combos and repairs missing match modes', () => {
      const state = normalizeSavedTagCombos({
        version: SAVED_TAG_COMBOS_VERSION,
        combos: [
          { id: 'c1', name: 'good', tagIds: ['t1', 't1', 7], match: 'any' },
          { id: 'c2', name: 'no tags', tagIds: [], match: 'all' },
          { id: '', name: 'no id', tagIds: ['t2'], match: 'all' },
          { id: 'c4', name: 'bad match', tagIds: ['t3'], match: 'sometimes' },
          'not an object',
        ],
      });

      expect(state.combos).toEqual([
        { id: 'c1', name: 'good', tagIds: ['t1'], match: 'any' },
        { id: 'c4', name: 'bad match', tagIds: ['t3'], match: 'all' },
      ]);
    });

    it('round-trips through the serializer', () => {
      const state = normalizeSavedTagCombos({
        version: SAVED_TAG_COMBOS_VERSION,
        combos: [{ id: 'c1', name: 'round trip', tagIds: ['t1'], match: 'none' }],
      });

      expect(parseSavedTagCombos(serializeSavedTagCombos(state))).toEqual(state);
    });
  });
});
