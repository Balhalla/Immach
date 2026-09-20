import type { TagResponseDto } from '@immich/sdk';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { getIntersectionObserverMock } from '$lib/__mocks__/intersection-observer.mock';
import { getVisualViewportMock } from '$lib/__mocks__/visual-viewport.mock';
import SearchTagsSection from '$lib/components/shared-components/search-bar/SearchTagsSection.svelte';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { searchManager } from '$lib/managers/search-manager.svelte';
import { preferencesFactory } from '@test-data/factories/preferences-factory';
import { userAdminFactory } from '@test-data/factories/user-factory';

const tag = (id: string, value: string): TagResponseDto => ({
  id,
  name: value,
  value,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const allTags = [
  tag('tag-1', 'holiday'),
  tag('tag-2', 'family'),
  tag('tag-3', 'NARAGONIA_QUARTET_2026'),
  tag('tag-4', 'JOHAN_WIJCHEN'),
  tag('tag-5', '2026'),
  tag('tag-6', 'MOUSTACHE'),
  tag('tag-7', 'MAIN_STAGE'),
  tag('tag-8', 'BALAFOLK'),
  tag('tag-9', 'BALHALLA'),
  tag('tag-10', 'BALHALLAFESTIVAL'),
];

describe('SearchTagsSection component', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', getIntersectionObserverMock());
    vi.stubGlobal('visualViewport', getVisualViewportMock());
    authManager.setUser(userAdminFactory.build());
    authManager.setPreferences(preferencesFactory.build({ tags: { enabled: true, sidebarWeb: true } }));
    searchManager.setQuery({ tagIds: ['tag-1', 'tag-2'] });
  });

  afterEach(() => {
    authManager.reset();
    searchManager.reset();
  });

  const renderSection = (tags = allTags) =>
    render(SearchTagsSection, {
      props: { title: undefined, parentPromise: Promise.resolve(tags) },
    });

  it('removes the tag when its chip is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();

    await screen.findByText('holiday');
    const removeButton = container.querySelector(':scope [data-tag-selected="holiday"] button');
    expect(removeButton).not.toBeNull();
    await user.click(removeButton!);

    expect(container.querySelector('[data-tag-selected="holiday"]')).toBeNull();
    expect([...(searchManager.filter.tagIds ?? [])]).toEqual(['tag-2']);
  });

  // removing the focused chip would otherwise drop focus to the body, which the
  // search bar treats as focus leaving the search panel
  it('keeps focus inside the section when a chip is removed', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();

    await screen.findByText('holiday');
    await user.click(container.querySelector(':scope [data-tag-selected="holiday"] button')!);

    expect(document.activeElement).not.toBe(document.body);
    expect(container.contains(document.activeElement)).toBe(true);
  });

  it('adds a tag picked from the categorized grid', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();

    await user.click(screen.getByRole('button', { name: 'Band & Workshop' }));
    await user.click(container.querySelector('[data-tag-chip="NARAGONIA_QUARTET_2026"]')!);

    expect([...(searchManager.filter.tagIds ?? [])]).toEqual(['tag-1', 'tag-2', 'tag-3']);
    expect(container.querySelector('[data-tag-selected="NARAGONIA_QUARTET_2026"]')).not.toBeNull();
  });

  it('defaults to the Edition category and filters the grid to it', async () => {
    const { container } = renderSection();

    expect(container.querySelector('[data-tag-category="Edition"]')?.getAttribute('aria-pressed')).toBe('true');
    await screen.findByText('2026');
    expect(container.querySelector('[data-tag-chip="NARAGONIA_QUARTET_2026"]')).toBeNull();
  });

  it('searches across all categories', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();

    await user.type(container.querySelector('[data-tag-chip-search]')!, 'naragonia');

    expect(await screen.findByText('NARAGONIA_QUARTET_2026')).toBeInTheDocument();
    expect(container.querySelector('[data-tag-chip="2026"]')).toBeNull();
  });

  it('changes the match mode on the shared search filter', async () => {
    const { container } = renderSection();
    await screen.findByText('2026');

    await fireEvent.click(container.querySelector('[data-tag-match="any"]')!);

    expect(searchManager.filter.tagMatch).toBe('any');
    expect(container.querySelector('[data-tag-match="any"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('sorts the selected pills photographer first', async () => {
    searchManager.setQuery({ tagIds: ['tag-3', 'tag-4', 'tag-5'] });
    const { container } = renderSection();
    await screen.findAllByText('2026');

    const selected = [...container.querySelectorAll<HTMLElement>('[data-tag-selected]')].map(
      (node) => node.dataset.tagSelected,
    );

    expect(selected).toEqual(['JOHAN_WIJCHEN', '2026', 'NARAGONIA_QUARTET_2026']);
  });

  it('scopes the picker to a single category without a category row', async () => {
    const { container } = render(SearchTagsSection, {
      props: {
        title: undefined,
        parentPromise: Promise.resolve(allTags),
        categoryNames: ['Photographer'],
        defaultCategory: 'Photographer',
        showCategoryRow: false,
      },
    });

    await screen.findByText('JOHAN_WIJCHEN');
    expect(container.querySelector('[data-tag-category-row]')).toBeNull();
    expect(container.querySelector('[data-tag-chip="2026"]')).toBeNull();
    expect(container.querySelector('[data-tag-chip="NARAGONIA_QUARTET_2026"]')).toBeNull();
  });

  it('lists the Organisation tags when scoped to that category', async () => {
    const { container } = render(SearchTagsSection, {
      props: {
        title: undefined,
        parentPromise: Promise.resolve(allTags),
        categoryNames: ['Organisation'],
        defaultCategory: 'Organisation',
        showCategoryRow: false,
      },
    });

    await screen.findByText('BALAFOLK');
    expect(container.querySelector('[data-tag-picker-empty]')).toBeNull();
    expect(container.querySelector('[data-tag-chip="BALHALLA"]')).not.toBeNull();
    expect(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL"]')).not.toBeNull();
  });

  it('shows the empty state for a category with no matching tags', async () => {
    const { container } = render(SearchTagsSection, {
      props: {
        title: undefined,
        parentPromise: Promise.resolve(allTags),
        categoryNames: ['Merch'],
        defaultCategory: 'Merch',
        showCategoryRow: false,
      },
    });

    await waitFor(() => expect(container.querySelector('[data-tag-picker-empty]')).not.toBeNull());
  });

  it('limits the category row to the remaining categories in the tags scope', async () => {
    const { container } = render(SearchTagsSection, {
      props: {
        title: undefined,
        parentPromise: Promise.resolve(allTags),
        categoryNames: ['People & Appearance', 'Band & Workshop'],
        defaultCategory: null,
      },
    });

    await screen.findByText('NARAGONIA_QUARTET_2026');
    const categories = [...container.querySelectorAll<HTMLElement>('[data-tag-category]')].map(
      (node) => node.dataset.tagCategory,
    );

    expect(categories).toEqual(['all', 'People & Appearance', 'Band & Workshop']);
    expect(await screen.findByText('MOUSTACHE')).toBeInTheDocument();
    expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).toBeNull();
  });

  it('keeps pinned selections from other categories when scoped', async () => {
    searchManager.setQuery({ tagIds: ['tag-4'] });
    const { container } = render(SearchTagsSection, {
      props: {
        title: undefined,
        parentPromise: Promise.resolve(allTags),
        categoryNames: ['Edition'],
        defaultCategory: 'Edition',
        showCategoryRow: false,
      },
    });

    await screen.findByText('2026');
    expect(container.querySelector('[data-tag-selected="JOHAN_WIJCHEN"]')).not.toBeNull();
  });
});
