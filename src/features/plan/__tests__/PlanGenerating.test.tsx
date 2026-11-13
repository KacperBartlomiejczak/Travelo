import { act, render, screen } from '@testing-library/react-native';

import { PlanGenerating } from '@/features/plan/PlanGenerating';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import { tokens } from '@/theme/tokens';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  FadeIn: { duration: (ms: number) => ({ durationV: ms }) },
}));
jest.mock('@/hooks/useReduceMotion');
const mockReduceMotion = jest.mocked(useReduceMotion);

beforeEach(async () => {
  jest.useFakeTimers();
  await i18n.changeLanguage('pl');
  mockReduceMotion.mockReturnValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('PlanGenerating', () => {
  it('starts on the first message', async () => {
    await render(<PlanGenerating />);
    expect(screen.getByText('Szukam miejsc…')).toBeOnTheScreen();
  });

  it('advances through the sequence and stays on the last message', async () => {
    await render(<PlanGenerating />);
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByText('Układam dni…')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByText('Już prawie gotowe…')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(60000));
    expect(screen.getByText('Już prawie gotowe…')).toBeOnTheScreen();
  });

  it('is a busy progressbar labelled with the current message', async () => {
    await render(<PlanGenerating />);
    const bar = screen.getByRole('progressbar', { name: 'Szukam miejsc…' });
    expect(bar).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByRole('progressbar', { name: 'Układam dni…' })).toBeOnTheScreen();
  });

  it('slides a segment normally and shows a static full track with reduced motion', async () => {
    const view = await render(<PlanGenerating />);
    expect(screen.getByTestId('plan-generating-segment')).toBeOnTheScreen();
    expect(screen.queryByTestId('plan-generating-static')).toBeNull();
    mockReduceMotion.mockReturnValue(true);
    await view.rerender(<PlanGenerating />);
    expect(screen.queryByTestId('plan-generating-segment')).toBeNull();
    expect(screen.getByTestId('plan-generating-static')).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByText('Układam dni…')).toBeOnTheScreen();
  });

  it('fills the bar with the brand colour, moving or static', async () => {
    const brand = tokens.colors.light.brand.primary;
    const view = await render(<PlanGenerating />);
    expect(screen.getByTestId('plan-generating-segment')).toHaveStyle({ backgroundColor: brand });
    mockReduceMotion.mockReturnValue(true);
    await view.rerender(<PlanGenerating />);
    expect(screen.getByTestId('plan-generating-static')).toHaveStyle({ backgroundColor: brand });
  });

  it('clears its timer on unmount', async () => {
    const set = jest.spyOn(global, 'setTimeout');
    const clear = jest.spyOn(global, 'clearTimeout');
    const view = await render(<PlanGenerating />);
    const id = set.mock.results.find((_, i) => set.mock.calls[i][1] === 4000)?.value;
    expect(id).toBeDefined();
    await view.unmount();
    expect(clear).toHaveBeenCalledWith(id);
  });

  it('crossfades the message over 180 ms, instantly under reduced motion', async () => {
    const view = await render(<PlanGenerating />);
    const { standard } = tokens.motion.duration;
    expect(screen.getByTestId('plan-generating-message').props.entering.durationV).toBe(standard);
    mockReduceMotion.mockReturnValue(true);
    await view.rerender(<PlanGenerating />);
    expect(screen.getByTestId('plan-generating-message').props.entering).toBeUndefined();
  });

  it('has its own headline', async () => {
    await render(<PlanGenerating />);
    expect(screen.getByText('Układam plan podróży…')).toBeOnTheScreen();
    await i18n.changeLanguage('en');
    await render(<PlanGenerating />);
    expect(screen.getByText('Building your trip plan…')).toBeOnTheScreen();
  });

  it('speaks English', async () => {
    await i18n.changeLanguage('en');
    await render(<PlanGenerating />);
    expect(screen.getByText('Finding places…')).toBeOnTheScreen();
  });
});
