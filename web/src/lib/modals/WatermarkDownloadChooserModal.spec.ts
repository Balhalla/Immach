import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { getAnimateMock } from '$lib/__mocks__/animate.mock';
import { getIntersectionObserverMock } from '$lib/__mocks__/intersection-observer.mock';
import { getVisualViewportMock } from '$lib/__mocks__/visual-viewport.mock';
import WatermarkDownloadChooserModal from './WatermarkDownloadChooserModal.svelte';

describe('WatermarkDownloadChooserModal component', () => {
  const onClose = vi.fn();

  beforeAll(async () => {
    await init({ fallbackLocale: 'en-US' });
    register('en-US', () => import('$i18n/en.json'));
    await waitLocale('en-US');
  });

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', getIntersectionObserverMock());
    vi.stubGlobal('visualViewport', getVisualViewportMock());
    vi.resetAllMocks();
    Element.prototype.animate = getAnimateMock();
  });

  afterAll(async () => {
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe('none');
    });
  });

  const getCleanOption = () => screen.getByRole('button', { name: 'Without watermark (clean)' });
  const getWatermarkOption = () => screen.getByRole('button', { name: 'With watermark' });

  it('renders the title and both options with the clean option first', () => {
    render(WatermarkDownloadChooserModal, { props: { onClose } });

    expect(screen.getByText('Download original')).toBeInTheDocument();
    const clean = getCleanOption();
    const watermark = getWatermarkOption();
    expect(clean.compareDocumentPosition(watermark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('highlights and focuses the clean option', () => {
    render(WatermarkDownloadChooserModal, { props: { onClose } });

    expect(getCleanOption()).toHaveFocus();
  });

  it('returns the clean choice when it is clicked', async () => {
    render(WatermarkDownloadChooserModal, { props: { onClose } });

    await fireEvent.click(getCleanOption());

    expect(onClose).toHaveBeenCalledWith('clean');
  });

  it('returns the watermark choice when it is clicked', async () => {
    render(WatermarkDownloadChooserModal, { props: { onClose } });

    await fireEvent.click(getWatermarkOption());

    expect(onClose).toHaveBeenCalledWith('watermark');
  });

  it('closes without a choice on Escape', async () => {
    const user = userEvent.setup();
    render(WatermarkDownloadChooserModal, { props: { onClose } });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledWith();
  });
});
