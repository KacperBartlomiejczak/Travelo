import { readFileSync } from 'fs';
import { join } from 'path';

import { colors, screenMetrics } from '../theme/tokens';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path));

// kit splash-icon.png (512x512): the symbol spans y 64-432
const SYMBOL_HEIGHT_RATIO_IN_IMAGE = 368 / 512;
// kit symbol height in its 256-unit space: sun top y 32 -> t bottom y 216
const KIT_SYMBOL_HEIGHT = 184;

type SplashOptions = {
  backgroundColor: string;
  image: string;
  imageWidth: number;
  dark: { backgroundColor: string; image: string };
};

const appJson = JSON.parse(read('app.json').toString('utf8')) as {
  expo: { plugins: (string | [string, SplashOptions])[] };
};
const splash = (
  appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, SplashOptions]
)[1];

type LottieLayer = { nm: string; refId?: string; ks: { s: { k: number[] } } };
type Lottie = { w: number; layers: LottieLayer[]; assets: { id: string; layers: LottieLayer[] }[] };

// Symbol height as a fraction of the comp width, from the precomp scale and the layer scale of `t` and `sun`.
const lottieSymbolHeightRatio = () => {
  const lottie = JSON.parse(read('assets/animations/splash.json').toString('utf8')) as Lottie;
  const heights = ['t', 'sun'].map((name) => {
    const layer = lottie.layers.find((l) => l.nm === name) as LottieLayer;
    const inner = (lottie.assets.find((a) => a.id === layer.refId) as { layers: LottieLayer[] }).layers[0];
    return (KIT_SYMBOL_HEIGHT * (inner.ks.s.k[0] / 100) * (layer.ks.s.k[0] / 100)) / lottie.w;
  });
  expect(heights[0]).toBeCloseTo(heights[1], 5);
  return heights[0];
};

const pngSize = (file: Buffer) => ({ width: file.readUInt32BE(16), height: file.readUInt32BE(20) });

describe('expo-splash-screen config', () => {
  it('uses the light canvas colour as background', () => {
    expect(splash.backgroundColor).toBe(colors.light.background.canvas);
  });

  it('uses the dark canvas colour as dark background', () => {
    expect(splash.dark?.backgroundColor).toBe(colors.dark.background.canvas);
  });

  it('points image and dark.image at existing 512x512 PNGs', () => {
    expect(pngSize(read(splash.image))).toEqual({ width: 512, height: 512 });
    expect(pngSize(read(splash.dark.image))).toEqual({ width: 512, height: 512 });
  });

  it('uses the kit splash icons byte for byte', () => {
    expect(read(splash.image).equals(read('design/logo/kit/expo/splash-icon.png'))).toBe(true);
    expect(read(splash.dark.image).equals(read('design/logo/kit/expo/splash-icon-dark.png'))).toBe(true);
  });

  it('matches the symbol height of the Lottie splash frame 0 within 1 dp', () => {
    const native = splash.imageWidth * SYMBOL_HEIGHT_RATIO_IN_IMAGE;
    const lottie = screenMetrics.splash.animationWidth * lottieSymbolHeightRatio();
    expect(Math.abs(native - lottie)).toBeLessThanOrEqual(1);
  });

  it('no longer uses the Expo template colour', () => {
    expect(JSON.stringify(splash).toUpperCase()).not.toContain('#208AEF');
  });
});
