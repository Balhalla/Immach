import '@testing-library/jest-dom';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { goto } from '$app/navigation';
import TagFilterButtonTestWrapper from '$lib/components/shared-components/tag-picker/TagFilterButton.test-wrapper.svelte';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { emptySavedTagCombos, saveTagCombo, savedTagCombos } from '$lib/stores/saved-tag-combos.store';
import { preferencesFactory } from '@test-data/factories/preferences-factory';
import { userAdminFactory } from '@test-data/factories/user-factory';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const gotoMock = vi.mocked(goto);

const submittedDto = () => {
  const url = gotoMock.mock.calls.at(-1)?.[0] as string;
  const raw = new URL(url, 'http://localhost').searchParams.get('query');
  return raw ? JSON.parse(raw) : {};
};

describe('TagFilterButton saved combinations', () => {
  beforeEach(() => {
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
    gotoMock.mockClear();
    authManager.setUser(userAdminFactory.build());
    authManager.setPreferences(preferencesFactory.build({ tags: { enabled: true, sidebarWeb: true } }));
  });

  afterEach(() => {
    authManager.reset();
    localStorage.clear();
    savedTagCombos.set(emptySavedTagCombos());
  });

  it('hides the saved combination row when there are none', () => {
    const { container } = render(TagFilterButtonTestWrapper);

    expect(container.querySelector('[data-tag-filter-button]')).not.toBeNull();
    expect(container.querySelector('[data-saved-combo-row]')).toBeNull();
  });

  it('applies a saved combination with a single click', async () => {
    const user = userEvent.setup();
    const combo = saveTagCombo('Balhalla 2026', ['tag-1', 'tag-2'], 'all')!;
    const { container } = render(TagFilterButtonTestWrapper);

    expect(container.querySelector('[data-saved-combo-row]')).not.toBeNull();
    await user.click(container.querySelector('[data-saved-combo-chip="Balhalla 2026"]')!);

    await vi.waitFor(() => expect(gotoMock).toHaveBeenCalled());
    expect(submittedDto()).toMatchObject({ tagIds: combo.tagIds, tagMatch: 'all' });
  });
});
