import type { TagResponseDto } from '@immich/sdk';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { SvelteSet } from 'svelte/reactivity';
import TagChipPicker from '$lib/components/shared-components/tag-picker/TagChipPicker.svelte';

// A future-edition workshop tag that the taxonomy will know once 2027 exists; the
// picker derives its year chips from taxonomy-known tags, so map it here.
vi.mock('$lib/utils/tag-taxonomy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/utils/tag-taxonomy')>();
  return {
    ...actual,
    categoryNameForTag: (tag: string) =>
      tag === 'WORKSHOP_HILDE_SINGING_2027' ? 'Band & Workshop' : actual.categoryNameForTag(tag),
  };
});

const tag = (id: string, value: string): TagResponseDto => ({
  id,
  name: value,
  value,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const allTags = [
  tag('tag-1', '2026'),
  tag('tag-2', 'JOHAN_WIJCHEN'),
  tag('tag-3', 'NARAGONIA_QUARTET_2026'),
  tag('tag-4', 'ROKKENDE_VROUWEN_2026'),
  tag('tag-5', 'WARMOES_2026'),
  tag('tag-6', 'holiday'),
  tag('tag-7', 'BALAFOLK'),
  tag('tag-8', 'BALHALLA'),
  tag('tag-9', 'BALHALLAFESTIVAL'),
  tag('tag-10', 'WORKSHOP_BRETON_DANCES_2026'),
  tag('tag-11', 'WORKSHOP_HILDE_SINGING_2027'),
];

const chipValues = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-tag-chip]')].map((node) => node.dataset.tagChip);

describe('TagChipPicker', () => {
  it('renders All + taxonomy categories with Edition first', () => {
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>() },
    });

    const categories = [...container.querySelectorAll<HTMLElement>('[data-tag-category]')].map(
      (node) => node.dataset.tagCategory,
    );
    expect(categories[0]).toBe('all');
    expect(categories[1]).toBe('Edition');
    expect(categories.indexOf('Edition')).toBeLessThan(categories.indexOf('Band & Workshop'));
  });

  it('filters the chip grid by category', async () => {
    const user = userEvent.setup();
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>(), defaultCategory: 'Edition' },
    });

    expect(chipValues(container)).toEqual(['2026']);

    await user.click(screen.getByRole('button', { name: 'Band & Workshop' }));
    expect(chipValues(container)).toEqual(['NARAGONIA_QUARTET_2026', 'ROKKENDE_VROUWEN_2026', 'WARMOES_2026']);
  });

  it('searches across all categories regardless of the active category', async () => {
    const user = userEvent.setup();
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>(), defaultCategory: 'Edition' },
    });

    await user.type(container.querySelector('[data-tag-chip-search]')!, 'nara');

    expect(chipValues(container)).toEqual(['NARAGONIA_QUARTET_2026']);
  });

  it('selects a contiguous range on shift-click', async () => {
    const selectedIds = new SvelteSet<string>();
    const { container } = render(TagChipPicker, { props: { allTags, selectedIds } });

    await fireEvent.click(container.querySelector('[data-tag-chip="NARAGONIA_QUARTET_2026"]')!);
    await fireEvent.click(container.querySelector('[data-tag-chip="WARMOES_2026"]')!, { shiftKey: true });

    expect([...selectedIds]).toEqual(['tag-3', 'tag-4', 'tag-5']);
  });

  it('offers tag creation when allowed', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>(), allowCreate: true, onCreate },
    });

    await user.type(container.querySelector('[data-tag-chip-search]')!, 'newtag');
    const createButton = container.querySelector('[data-tag-create]');
    expect(createButton).not.toBeNull();
    await user.click(createButton!);

    expect(onCreate).toHaveBeenCalledWith('newtag');
    expect(container.querySelector('[data-tag-create]')).toBeNull();
  });

  it('does not offer tag creation when not allowed', async () => {
    const user = userEvent.setup();
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>() },
    });

    await user.type(container.querySelector('[data-tag-chip-search]')!, 'newtag');

    expect(container.querySelector('[data-tag-create]')).toBeNull();
  });

  it('renders selected pills photographer first, then Edition, then taxonomy order', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet(['tag-3', 'tag-2', 'tag-1']),
        sortSelected: true,
      },
    });

    const selected = [...container.querySelectorAll<HTMLElement>('[data-tag-selected]')].map(
      (node) => node.dataset.tagSelected,
    );
    expect(selected).toEqual(['JOHAN_WIJCHEN', '2026', 'NARAGONIA_QUARTET_2026']);
  });

  it('shows the match-mode toggle only when requested', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>(), showMatchMode: true, onSelectionChange },
    });

    const modes = [...container.querySelectorAll<HTMLElement>('[data-tag-match]')].map((node) => node.dataset.tagMatch);
    expect(modes).toEqual(['all', 'any', 'none']);
    expect(container.querySelector('[data-tag-match="all"]')?.getAttribute('aria-pressed')).toBe('true');

    await fireEvent.click(container.querySelector('[data-tag-match="none"]')!);

    expect(container.querySelector('[data-tag-match="none"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('hides the match-mode toggle by default', () => {
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>() },
    });

    expect(container.querySelector('[data-tag-match]')).toBeNull();
  });

  it('clears the selection with the clear button', async () => {
    const user = userEvent.setup();
    const selectedIds = new SvelteSet(['tag-1', 'tag-2']);
    const { container } = render(TagChipPicker, { props: { allTags, selectedIds } });

    await user.click(container.querySelector('[data-tag-chips-clear]')!);

    expect(selectedIds.size).toBe(0);
  });

  it('removes a selected pill', async () => {
    const user = userEvent.setup();
    const selectedIds = new SvelteSet(['tag-1', 'tag-2']);
    const { container } = render(TagChipPicker, { props: { allTags, selectedIds } });

    await user.click(container.querySelector(':scope [data-tag-selected="JOHAN_WIJCHEN"] button')!);

    expect([...selectedIds]).toEqual(['tag-1']);
  });

  it('restricts the category row and chip grid to the given categories', () => {
    const { container } = render(TagChipPicker, {
      props: { allTags, selectedIds: new SvelteSet<string>(), categoryNames: ['Edition', 'Photographer'] },
    });

    const categories = [...container.querySelectorAll<HTMLElement>('[data-tag-category]')].map(
      (node) => node.dataset.tagCategory,
    );
    expect(categories).toEqual(['all', 'Edition', 'Photographer']);
    expect(chipValues(container)).toEqual(['2026', 'JOHAN_WIJCHEN']);
  });

  it('hides the category row and scopes the grid when requested', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        categoryNames: ['Band & Workshop'],
        defaultCategory: 'Band & Workshop',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-category-row]')).toBeNull();
    expect(chipValues(container)).toEqual(['NARAGONIA_QUARTET_2026', 'ROKKENDE_VROUWEN_2026', 'WARMOES_2026']);
  });

  it('scopes Band & Workshop to the latest year of the selected kind by default', async () => {
    const user = userEvent.setup();
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        defaultCategory: 'Band & Workshop',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-bw-filters]')).not.toBeNull();
    expect(chipValues(container)).toEqual(['NARAGONIA_QUARTET_2026', 'ROKKENDE_VROUWEN_2026', 'WARMOES_2026']);

    await user.click(container.querySelector('[data-tag-bw-kind="workshop"]')!);
    expect(chipValues(container)).toEqual(['WORKSHOP_HILDE_SINGING_2027']);

    await user.click(container.querySelector('[data-tag-bw-year="2026"]')!);
    expect(chipValues(container)).toEqual(['WORKSHOP_BRETON_DANCES_2026']);

    await user.click(container.querySelector('[data-tag-bw-year="all"]')!);
    expect(chipValues(container)).toEqual(['WORKSHOP_BRETON_DANCES_2026', 'WORKSHOP_HILDE_SINGING_2027']);

    await user.click(container.querySelector('[data-tag-bw-kind="band"]')!);
    expect(chipValues(container)).toEqual(['NARAGONIA_QUARTET_2026', 'ROKKENDE_VROUWEN_2026', 'WARMOES_2026']);
  });

  it('hides the Band & Workshop sub-filters outside that category', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        defaultCategory: 'Edition',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-bw-filters]')).toBeNull();
  });

  it('searches only within the restricted categories', async () => {
    const user = userEvent.setup();
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        categoryNames: ['Edition'],
        defaultCategory: 'Edition',
        showCategoryRow: false,
      },
    });

    await user.type(container.querySelector('[data-tag-chip-search]')!, 'johan');
    expect(chipValues(container)).toEqual([]);

    await user.clear(container.querySelector('[data-tag-chip-search]')!);
    await user.type(container.querySelector('[data-tag-chip-search]')!, '2026');
    expect(chipValues(container)).toEqual(['2026']);
  });

  it('lists the Organisation tags when scoped to that category', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        categoryNames: ['Organisation'],
        defaultCategory: 'Organisation',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-picker-empty]')).toBeNull();
    expect(chipValues(container)).toEqual(['BALAFOLK', 'BALHALLA', 'BALHALLAFESTIVAL']);
  });

  it('shows an empty state for a category with no matching tags', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet<string>(),
        categoryNames: ['Location'],
        defaultCategory: 'Location',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-picker-empty]')).not.toBeNull();
    expect(chipValues(container)).toEqual([]);
  });

  it('keeps selected pills visible when they are outside the scoped categories', () => {
    const { container } = render(TagChipPicker, {
      props: {
        allTags,
        selectedIds: new SvelteSet(['tag-2']),
        categoryNames: ['Edition'],
        defaultCategory: 'Edition',
        showCategoryRow: false,
      },
    });

    expect(container.querySelector('[data-tag-selected="JOHAN_WIJCHEN"]')).not.toBeNull();
    expect(chipValues(container)).toEqual(['2026']);
  });
});
