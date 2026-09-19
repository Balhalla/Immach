import type { TagResponseDto } from '@immich/sdk';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { get } from 'svelte/store';
import { sdkMock } from '$lib/__mocks__/sdk.mock';
import TagFilterPopover from '$lib/components/shared-components/tag-picker/TagFilterPopover.svelte';
import {
  SAVED_TAG_COMBOS_KEY,
  emptySavedTagCombos,
  saveTagCombo,
  savedTagCombos,
} from '$lib/stores/saved-tag-combos.store';

const tag = (id: string, value: string): TagResponseDto => ({
  id,
  name: value,
  value,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const allTags = [tag('tag-1', 'JOHAN_WIJCHEN'), tag('tag-2', '2026')];

describe('TagFilterPopover saved combinations', () => {
  beforeEach(() => {
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
    sdkMock.getAllTags.mockResolvedValue(allTags);
  });

  afterEach(() => {
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
    sdkMock.getAllTags.mockReset();
  });

  const renderPopover = () =>
    render(TagFilterPopover, {
      props: { initialTagIds: [], initialMatchMode: 'all' as const, onApply: vi.fn(), onClose: vi.fn() },
    });

  const selectJohan = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Photographer' }));
    await user.click(await screen.findByRole('button', { name: 'JOHAN_WIJCHEN' }));
  };

  it('saves the current selection with a name and the match mode', async () => {
    const user = userEvent.setup();
    const { container } = renderPopover();

    await selectJohan(user);
    await user.click(container.querySelector('[data-tag-match="any"]')!);
    await user.type(container.querySelector('[data-tag-combo-name]')!, 'Johan');
    await user.click(container.querySelector('[data-tag-combo-save-button]')!);

    expect(get(savedTagCombos).combos).toHaveLength(1);
    expect(get(savedTagCombos).combos[0]).toMatchObject({ name: 'Johan', tagIds: ['tag-1'], match: 'any' });
    expect(localStorage.getItem(SAVED_TAG_COMBOS_KEY)).toContain('Johan');
    expect(container.querySelector('[data-saved-combo="Johan"]')).not.toBeNull();
  });

  it('does not save without a name', async () => {
    const user = userEvent.setup();
    const { container } = renderPopover();

    await selectJohan(user);
    await user.click(container.querySelector('[data-tag-combo-save-button]')!);

    expect(get(savedTagCombos).combos).toHaveLength(0);
  });

  it('applies and deletes saved combinations', async () => {
    const user = userEvent.setup();
    const combo = saveTagCombo('Balhalla', ['tag-1', 'tag-2'], 'all')!;
    const onApply = vi.fn();
    const { container } = render(TagFilterPopover, {
      props: { initialTagIds: [], initialMatchMode: 'all' as const, onApply, onClose: vi.fn() },
    });

    await user.click(container.querySelector('[data-saved-combo-apply="Balhalla"]')!);
    expect(onApply).toHaveBeenCalledWith(combo.tagIds, 'all');

    await user.click(container.querySelector('[data-saved-combo-delete="Balhalla"]')!);
    expect(get(savedTagCombos).combos).toHaveLength(0);
    expect(container.querySelector('[data-saved-combo="Balhalla"]')).toBeNull();
  });
});
