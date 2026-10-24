import { readFileSync } from 'fs';
import { join } from 'path';

import { colors, primitives } from '../../theme/tokens';

type LottieLayer = {
  nm?: string;
  td?: number;
  tt?: number;
  refId?: string;
  shapes?: unknown[];
};
type Lottie = {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  layers: LottieLayer[];
  assets?: { id: string; layers?: LottieLayer[] }[];
};

const lottie: Lottie = JSON.parse(
  readFileSync(join(__dirname, '../../../assets/animations/splash.json'), 'utf8'),
);

const toHex = ([r, g, b]: number[]) =>
  '#' +
  [r, g, b]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

// Collects solid fill colours (ty: "fl") from a shape tree.
const fillsIn = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(fillsIn);
  if (node === null || typeof node !== 'object') return [];
  const obj = node as { ty?: string; c?: { k?: unknown } } & Record<string, unknown>;
  const own =
    obj.ty === 'fl' && Array.isArray(obj.c?.k) && typeof obj.c.k[0] === 'number'
      ? [toHex(obj.c.k as number[])]
      : [];
  return [...own, ...Object.values(obj).flatMap(fillsIn)];
};

// Fills on every layer that is rendered (matte sources are skipped), following precomps.
const renderedFills = (layers: LottieLayer[]): string[] =>
  layers
    .filter((layer) => layer.td !== 1)
    .flatMap((layer) => {
      const asset = lottie.assets?.find((a) => a.id === layer.refId);
      return [...fillsIn(layer.shapes), ...renderedFills(asset?.layers ?? [])];
    });

describe('splash Lottie asset', () => {
  it('parses and has the required top-level fields', () => {
    for (const key of ['v', 'fr', 'ip', 'op', 'w', 'h', 'layers'] as const) {
      expect(lottie[key]).toBeDefined();
    }
  });

  it('lasts between 1.2 s and 2.0 s', () => {
    const seconds = (lottie.op - lottie.ip) / lottie.fr;
    expect(seconds).toBeGreaterThanOrEqual(1.2);
    expect(seconds).toBeLessThanOrEqual(2.0);
  });

  it('names the layers used as colour-filter keypaths', () => {
    const names = lottie.layers.map((layer) => layer.nm);
    expect(names).toEqual(expect.arrayContaining(['t', 'sun', 'wordmark']));
  });

  it('uses only ink and coral for rendered fills', () => {
    const allowed = [primitives.ink, colors.light.brand.primary];
    const fills = renderedFills(lottie.layers);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) expect(allowed).toContain(fill);
  });

  it('track-mats the wordmark with the layer above it', () => {
    const index = lottie.layers.findIndex((layer) => layer.nm === 'wordmark');
    expect(index).toBeGreaterThan(0);
    expect(lottie.layers[index].tt).toBeDefined();
    expect(lottie.layers[index - 1].td).toBe(1);
  });
});
