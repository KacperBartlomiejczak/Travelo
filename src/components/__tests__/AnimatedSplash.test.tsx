import { act, render, screen } from '@testing-library/react-native';
import LottieView from 'lottie-react-native';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import { darkTheme, lightTheme } from '@/theme/theme';
import { primitives, tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

import splash from '../../../assets/animations/splash.json';

jest.mock('@/hooks/useReduceMotion');
const mockReduceMotion = jest.mocked(useReduceMotion);

const { animationWidth } = tokens.screenMetrics.splash;
const fade = tokens.motion.duration.standard;

beforeEach(async () => {
  jest.useFakeTimers();
  mockReduceMotion.mockReturnValue(false);
  await i18n.changeLanguage('pl');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const lottie = () => screen.getByTestId('splash-lottie');
const spinner = () => screen.queryByTestId('splash-spinner');

async function finishAnimation() {
  await act(async () => {
    lottie().props.onAnimationFinish(false);
  });
}

async function pass(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('AnimatedSplash (splash-animation step 4)', () => {
  it('plays the splash animation once, 280 dp wide and half as high, on the canvas colour', async () => {
    await render(<AnimatedSplash ready={false} onDone={() => {}} />);
    expect(lottie().props.loop).toBe(false);
    expect(lottie().props.autoPlay).toBe(true);
    expect(lottie().props.source).toBe(splash);
    expect(lottie()).toHaveStyle({ width: animationWidth, height: animationWidth * (splash.h / splash.w) });
    expect(animationWidth * (splash.h / splash.w)).toBe(140);
    expect(screen.getByTestId('splash-overlay')).toHaveStyle({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: lightTheme.background.canvas,
    });
  });

  it('starts playing once the system has said motion is allowed (the answer arrives after the first render)', async () => {
    const play = jest.spyOn(LottieView.prototype, 'play');
    mockReduceMotion.mockReturnValue(null);
    const view = await render(<AnimatedSplash ready={false} onDone={() => {}} />);
    expect(play).not.toHaveBeenCalled();
    mockReduceMotion.mockReturnValue(false);
    await view.rerender(<AnimatedSplash ready={false} onDone={() => {}} />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('shows no spinner before the animation ends, even when the app is not ready', async () => {
    await render(<AnimatedSplash ready={false} onDone={() => {}} />);
    await pass(5000);
    expect(spinner()).toBeNull();
  });

  it('shows a busy, labelled spinner under the logo when the animation ended and the app is not ready', async () => {
    const onDone = jest.fn();
    await render(<AnimatedSplash ready={false} onDone={onDone} />);
    await finishAnimation();
    expect(spinner()).toBeTruthy();
    expect(spinner()?.props.accessibilityState).toEqual({ busy: true });
    expect(spinner()?.props.accessibilityLabel).toBe('Ładowanie aplikacji');
    expect(screen.getByLabelText('Ładowanie aplikacji')).toBe(spinner());
    expect(lottie()).toBeTruthy(); // the lockup stays on screen
    await pass(5000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('labels the spinner in English', async () => {
    await i18n.changeLanguage('en');
    await render(<AnimatedSplash ready={false} onDone={() => {}} />);
    await finishAnimation();
    expect(spinner()?.props.accessibilityLabel).toBe('Loading app');
  });

  it('colours the spinner with the brand colour', async () => {
    await render(<AnimatedSplash ready={false} onDone={() => {}} />);
    await finishAnimation();
    expect(spinner()?.props.color).toBe(lightTheme.brand.primary);
  });

  it('removes the spinner when the app becomes ready, and calls onDone exactly once after the fade', async () => {
    const onDone = jest.fn();
    const view = await render(<AnimatedSplash ready={false} onDone={onDone} />);
    await finishAnimation();
    await view.rerender(<AnimatedSplash ready onDone={onDone} />);
    expect(spinner()).toBeNull();
    await pass(fade - 1);
    expect(onDone).not.toHaveBeenCalled();
    await pass(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    await pass(5000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows no spinner at all when the app is already ready as the animation ends', async () => {
    const onDone = jest.fn();
    await render(<AnimatedSplash ready onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled(); // waits for the animation
    await finishAnimation();
    expect(spinner()).toBeNull();
    await pass(fade);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays on to the end when the animation cannot load, so the app is never stuck behind the splash', async () => {
    const onDone = jest.fn();
    await render(<AnimatedSplash ready onDone={onDone} />);
    await act(async () => {
      lottie().props.onAnimationFailure('broken');
    });
    await pass(fade);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  describe('reduce motion (§9.4)', () => {
    it('true: shows the final frame without playing, spinner right away while the app is not ready', async () => {
      mockReduceMotion.mockReturnValue(true);
      await render(<AnimatedSplash ready={false} onDone={() => {}} />);
      expect(lottie().props.autoPlay).toBe(false);
      expect(lottie().props.progress).toBe(1);
      expect(spinner()).toBeTruthy();
    });

    it('true: calls onDone after the shorter reduced fade without any animationFinish event', async () => {
      mockReduceMotion.mockReturnValue(true);
      const onDone = jest.fn();
      await render(<AnimatedSplash ready onDone={onDone} />);
      expect(spinner()).toBeNull();
      await pass(tokens.motion.duration.reduced - 1);
      expect(onDone).not.toHaveBeenCalled();
      await pass(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('null (not known yet): frame 0, not playing, no spinner, not finished even when ready', async () => {
      mockReduceMotion.mockReturnValue(null);
      const onDone = jest.fn();
      await render(<AnimatedSplash ready onDone={onDone} />);
      expect(lottie().props.autoPlay).toBe(false);
      expect(lottie().props.progress).toBe(0);
      expect(spinner()).toBeNull();
      await pass(5000);
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe('theme (splash-animation D2)', () => {
    it('light: no colour filters, the animation keeps its own ink and coral', async () => {
      await render(<AnimatedSplash ready={false} onDone={() => {}} />);
      expect(lottie().props.colorFilters ?? []).toEqual([]);
    });

    it('dark: paper t and wordmark, dark coral sun, on the dark canvas; the matte is left alone', async () => {
      await render(<AnimatedSplash ready={false} onDone={() => {}} />, { wrapper: DarkThemeScope });
      const filters: { keypath: string; color: string }[] = lottie().props.colorFilters;
      expect(Object.fromEntries(filters.map((f) => [f.keypath, f.color]))).toEqual({
        t: primitives.neutral[100],
        sun: darkTheme.brand.primary,
        wordmark: primitives.neutral[100],
      });
      expect(filters.some((f) => f.keypath === 'wordmark-matte')).toBe(false);
      expect(screen.getByTestId('splash-overlay')).toHaveStyle({ backgroundColor: darkTheme.background.canvas });
    });

    it('dark: the spinner uses the dark brand colour', async () => {
      await render(<AnimatedSplash ready={false} onDone={() => {}} />, { wrapper: DarkThemeScope });
      await finishAnimation();
      expect(spinner()?.props.color).toBe(darkTheme.brand.primary);
    });
  });
});
