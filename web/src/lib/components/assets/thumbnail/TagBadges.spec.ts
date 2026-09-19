import type { TagResponseDto } from '@immich/sdk';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import TagBadges from '$lib/components/assets/thumbnail/TagBadges.svelte';
import { tagBadgeManager } from '$lib/managers/tag-badge-manager.svelte';
import { mediaQueryManager } from '$lib/stores/media-query-manager.svelte';
import { showTagBadges } from '$lib/stores/preferences.store';

const tag = (id: string, value: string, color?: string): TagResponseDto => ({
  id,
  name: value,
  value,
  color,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const tags = [
  tag('t-photo', 'JOHAN_WIJCHEN', '#475569'),
  tag('t-edition', '2026', '#7c2d12'),
  tag('t-band', 'NARAGONIA_QUARTET', '#4f46e5'),
  tag('t-people', 'MOUSTACHE'),
];

const popoverItems = () =>
  [...document.querySelectorAll<HTMLElement>('[data-tag-badge-popover-item]')].map(
    (node) => node.dataset.tagBadgePopoverItem,
  );

describe('TagBadges', () => {
  beforeEach(() => {
    showTagBadges.set(true);
    vi.spyOn(tagBadgeManager, 'tagsFor').mockReturnValue(tags);
    vi.spyOn(tagBadgeManager, 'hasTags').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const node of document.querySelectorAll('[data-tag-badge-popover]')) {
      node.remove();
    }
  });

  it('renders the capped badge row and the hidden count', () => {
    const { container } = render(TagBadges, { props: { assetId: 'a1' } });

    expect(
      [...container.querySelectorAll<HTMLElement>('[data-tag-badge]')].map((node) => node.dataset.tagBadge),
    ).toEqual(['JOHAN_WIJCHEN', '2026', 'NARAGONIA_QUARTET']);
    expect(container.querySelector('[data-tag-badge-count]')?.textContent?.trim()).toBe('+1');
  });

  it('opens the full tag list with category colors on hover and closes on Escape', async () => {
    vi.useFakeTimers();
    const { container } = render(TagBadges, { props: { assetId: 'a1' } });
    const row = container.querySelector('[data-tag-badges]')!;

    await fireEvent.mouseEnter(row);
    vi.advanceTimersByTime(200);
    await tick();

    expect(document.querySelector('[data-tag-badge-popover]')).not.toBeNull();
    expect(popoverItems()).toEqual(['JOHAN_WIJCHEN', '2026', 'NARAGONIA_QUARTET', 'MOUSTACHE']);
    expect(document.querySelector('[data-tag-badge-popover-item="JOHAN_WIJCHEN"]')).toHaveStyle({
      backgroundColor: '#475569',
    });
    expect(document.querySelector('[data-tag-badge-popover-item="MOUSTACHE"]')).toHaveStyle({
      backgroundColor: '#e11d48',
    });

    await fireEvent.keyDown(document, { key: 'Escape' });
    await tick();

    expect(document.querySelector('[data-tag-badge-popover]')).toBeNull();
  });

  it('opens the full tag list with the keyboard', async () => {
    const { container } = render(TagBadges, { props: { assetId: 'a1' } });
    const row = container.querySelector('[data-tag-badges]')!;

    await fireEvent.keyDown(row, { key: 'Enter' });
    await tick();

    expect(document.querySelector('[data-tag-badge-popover]')).not.toBeNull();
    expect(popoverItems()).toHaveLength(tags.length);
  });

  it('toggles the popover on tap for coarse pointers', async () => {
    vi.spyOn(mediaQueryManager, 'pointerCoarse', 'get').mockReturnValue(true);
    const { container } = render(TagBadges, { props: { assetId: 'a1' } });
    const row = container.querySelector('[data-tag-badges]')!;

    const firstTap = new MouseEvent('click', { bubbles: true, cancelable: true });
    row.dispatchEvent(firstTap);
    await tick();

    expect(firstTap.defaultPrevented).toBe(true);
    expect(document.querySelector('[data-tag-badge-popover]')).not.toBeNull();

    const secondTap = new MouseEvent('click', { bubbles: true, cancelable: true });
    row.dispatchEvent(secondTap);
    await tick();

    expect(document.querySelector('[data-tag-badge-popover]')).toBeNull();
  });

  it('lets fine-pointer clicks bubble to the thumbnail', () => {
    const { container } = render(TagBadges, { props: { assetId: 'a1' } });
    const row = container.querySelector('[data-tag-badges]')!;
    const bubbled = vi.fn();
    container.addEventListener('click', bubbled);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    row.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(bubbled).toHaveBeenCalledTimes(1);
  });
});
