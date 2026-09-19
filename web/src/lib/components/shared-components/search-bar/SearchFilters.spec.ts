import type { TagResponseDto } from '@immich/sdk';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { getIntersectionObserverMock } from '$lib/__mocks__/intersection-observer.mock';
import { sdkMock } from '$lib/__mocks__/sdk.mock';
import { getVisualViewportMock } from '$lib/__mocks__/visual-viewport.mock';
import SearchFilters from '$lib/components/shared-components/search-bar/SearchFilters.svelte';
import { authManager } from '$lib/managers/auth-manager.svelte';
import { featureFlagsManager } from '$lib/managers/feature-flags-manager.svelte';
import { searchManager } from '$lib/managers/search-manager.svelte';
import { TAG_CATEGORIES } from '$lib/utils/tag-taxonomy';
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
  tag('tag-1', 'BALHALLAFESTIVAL_2026'),
  tag('tag-2', 'BALAFOLK_2026'),
  tag('tag-3', 'JOHAN_WIJCHEN'),
  tag('tag-4', 'GABRIELE_SAVA'),
  tag('tag-5', 'MAIN_STAGE'),
  tag('tag-6', 'NARAGONIA_QUARTET'),
  tag('tag-7', 'MOUSTACHE'),
  tag('tag-8', 'holiday'),
];

const DEDICATED_CATEGORIES = ['Photographer', 'Organisation', 'Edition', 'Location', 'Band & Workshop'];

const tabNames = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-tag-filter-tab]')].map((node) => node.dataset.tagFilterTab);

const categoryChips = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-tag-category]')].map((node) => node.dataset.tagCategory);

const clickTab = (container: HTMLElement, name: string) =>
  container.querySelector(`:scope [data-tag-filter-tab="${CSS.escape(name)}"] button`)!;

describe('SearchFilters rev4 tag tabs', () => {
  beforeEach(async () => {
    vi.stubGlobal('IntersectionObserver', getIntersectionObserverMock());
    vi.stubGlobal('visualViewport', getVisualViewportMock());
    authManager.setUser(userAdminFactory.build());
    authManager.setPreferences(preferencesFactory.build({ tags: { enabled: true, sidebarWeb: true } }));
    sdkMock.getAllTags.mockResolvedValue(allTags);
    sdkMock.getSearchSuggestions.mockResolvedValue([]);
    sdkMock.getServerFeatures.mockResolvedValue({
      configFile: false,
      duplicateDetection: false,
      email: false,
      facialRecognition: false,
      importFaces: false,
      map: false,
      oauth: false,
      oauthAutoLaunch: false,
      ocr: false,
      passwordLogin: true,
      realtimeTranscoding: false,
      reverseGeocoding: false,
      search: true,
      sidecar: false,
      smartSearch: false,
      trash: false,
    });
    await featureFlagsManager.init();
  });

  afterEach(() => {
    authManager.reset();
    searchManager.reset();
    sdkMock.getAllTags.mockReset();
    sdkMock.getSearchSuggestions.mockReset();
    sdkMock.getServerFeatures.mockReset();
  });

  const renderFilters = () =>
    render(SearchFilters, {
      props: {
        id: 'search-filters',
        isOpen: true,
        onSelectSearchTerm: vi.fn(),
        onClearSearchTerm: vi.fn(),
        onClearAllSearchTerms: vi.fn(),
        onActiveSelectionChange: vi.fn(),
        onSearch: vi.fn(),
      },
    });

  it('renders the six taxonomy tabs in the locked order with the dedicated labels', () => {
    const { container } = renderFilters();

    expect(tabNames(container)).toEqual(['photographer', 'organisation', 'edition', 'location', 'band', 'tags']);
    const label = (name: string) =>
      container.querySelector(`:scope [data-tag-filter-tab="${CSS.escape(name)}"]`)?.textContent?.trim();
    expect(label('photographer')).toBe('Photographer');
    expect(label('organisation')).toBe('Organisation');
    expect(label('edition')).toBe('Edition');
    expect(label('location')).toBe('Location');
    expect(label('band')).toBe('Band & Workshop');
  });

  it('defaults to the Edition tab and scopes the grid to edition tags without a category row', async () => {
    const { container } = renderFilters();

    await waitFor(() => expect(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL_2026"]')).not.toBeNull());
    expect(container.querySelector('[data-tag-chip="BALAFOLK_2026"]')).not.toBeNull();
    expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).toBeNull();
    expect(container.querySelector('[data-tag-category-row]')).toBeNull();
  });

  it('scopes the Photographer tab to photographer tags only', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await user.click(clickTab(container, 'photographer'));

    await waitFor(() => expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).not.toBeNull());
    expect(container.querySelector('[data-tag-chip="GABRIELE_SAVA"]')).not.toBeNull();
    expect(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL_2026"]')).toBeNull();
    expect(container.querySelector('[data-tag-category-row]')).toBeNull();
  });

  it('shows the renamed Location category tags on the Location tab', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await user.click(clickTab(container, 'location'));

    await waitFor(() => expect(container.querySelector('[data-tag-chip="MAIN_STAGE"]')).not.toBeNull());
    expect(container.querySelector('[data-tag-chip="MOUSTACHE"]')).toBeNull();
    expect(container.querySelector('[data-tag-category-row]')).toBeNull();
  });

  it('shows the Band & Workshop tab scoped to band tags', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await user.click(clickTab(container, 'band'));

    await waitFor(() => expect(container.querySelector('[data-tag-chip="NARAGONIA_QUARTET"]')).not.toBeNull());
    expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).toBeNull();
  });

  it('shows the empty state on the Organisation tab', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await user.click(clickTab(container, 'organisation'));

    await waitFor(() => expect(container.querySelector('[data-tag-picker-empty]')).not.toBeNull());
    expect(container.querySelector('[data-tag-chip]')).toBeNull();
  });

  it('restricts the Tags tab to the remaining categories only', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await user.click(clickTab(container, 'tags'));

    await waitFor(() => expect(categoryChips(container)).toContain('People & Appearance'));
    const categories = categoryChips(container);
    for (const dedicated of DEDICATED_CATEGORIES) {
      expect(categories).not.toContain(dedicated);
    }
    expect(categories.filter((category) => category !== 'all' && category !== 'other')).toHaveLength(
      TAG_CATEGORIES.length - DEDICATED_CATEGORIES.length,
    );
    expect(container.querySelector('[data-tag-chip="MOUSTACHE"]')).not.toBeNull();
    expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).toBeNull();
    expect(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL_2026"]')).toBeNull();
  });

  it('keeps pinned selections across tab switches and shares the match mode', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    await waitFor(() => expect(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL_2026"]')).not.toBeNull());
    await user.click(container.querySelector('[data-tag-chip="BALHALLAFESTIVAL_2026"]')!);
    await user.click(clickTab(container, 'photographer'));
    await waitFor(() => expect(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')).not.toBeNull());
    await user.click(container.querySelector('[data-tag-chip="JOHAN_WIJCHEN"]')!);

    expect(container.querySelector('[data-tag-selected="BALHALLAFESTIVAL_2026"]')).not.toBeNull();
    expect(container.querySelector('[data-tag-selected="JOHAN_WIJCHEN"]')).not.toBeNull();
    expect([...(searchManager.filter.tagIds ?? [])].sort()).toEqual(['tag-1', 'tag-3']);
    expect(container.querySelector('[data-tag-match]')).not.toBeNull();
  });

  it('keeps the native filters under the collapsed Advanced filters disclosure', async () => {
    const user = userEvent.setup();
    const { container } = renderFilters();

    const disclosure = container.querySelector('[data-advanced-filter-tabs]')?.closest('[inert]');
    expect(disclosure).not.toBeNull();
    expect(container.querySelector('[data-advanced-filter-tab]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'advanced_filters' }));

    expect(container.querySelector('[data-advanced-filter-tabs]')?.closest('[inert]')).toBeNull();
    await user.click(container.querySelector(':scope [data-advanced-filter-tab="media"] button')!);
    await waitFor(() => expect(container.querySelector('#media-type-selection')).not.toBeNull());
  });
});
