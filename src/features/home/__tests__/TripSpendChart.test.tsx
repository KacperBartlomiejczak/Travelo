import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import i18n from '@/i18n';
import { formatMoney } from '@/lib/money';
import type { DailySpend } from '@/schemas';
import { colors, tokens } from '@/theme/tokens';

import { TripSpendChart } from '../TripSpendChart';

jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: jest.fn(() => null) }));
jest.mock('react-native-gifted-charts', () => {
  const { View } = jest.requireActual('react-native');
  const stub = (testID: string) =>
    function Stub({ centerLabelComponent, ...props }: { centerLabelComponent?: () => unknown }) {
      return (
        <View testID={testID} {...(props as object)}>
          {centerLabelComponent?.() as never}
        </View>
      );
    };
  return { LineChart: stub('line-chart'), BarChart: stub('bar-chart'), PieChart: stub('pie-chart') };
});

const money = (amountMinor: number) => formatMoney({ amountMinor, currency: 'PLN' }, 'pl');
const days: DailySpend[] = [
  { spentOn: '2026-07-01', spentMinor: 1000 },
  { spentOn: '2026-07-02', spentMinor: 0 },
  { spentOn: '2026-07-03', spentMinor: 3000 },
];
const hidden = { includeHiddenElements: true };
const values = (id: string) => screen.getByTestId(id, hidden).props.data.map((d: { value: number }) => d.value);

const renderChart = async (props: Partial<Parameters<typeof TripSpendChart>[0]> = {}, layoutWidth: number | null = 300) => {
  const onPress = jest.fn();
  await render(<TripSpendChart style="line" days={days} spentMinor={4000} leftMinor={6000} currency="PLN" onPress={onPress} {...props} />);
  if (layoutWidth !== null) {
    await fireEvent(screen.getByTestId('trip-spend-chart-frame'), 'layout', { nativeEvent: { layout: { width: layoutWidth, height: 0 } } });
  }
  return onPress;
};

beforeEach(async () => {
  jest.mocked(useReduceMotion).mockReturnValue(null);
  await i18n.changeLanguage('pl');
});

describe('TripSpendChart', () => {
  it('line: one point per day with the day spend', async () => {
    await renderChart();
    expect(values('line-chart')).toEqual([10, 0, 30]);
    expect(screen.queryByTestId('bar-chart', hidden)).toBeNull();
  });

  it('bar: spent and left bars', async () => {
    await renderChart({ style: 'bar' });
    expect(values('bar-chart')).toEqual([40, 60]);
  });

  it('donut: spent and left segments', async () => {
    await renderChart({ style: 'donut' });
    expect(values('pie-chart')).toEqual([40, 60]);
  });

  it('draws nothing until the available width is known, then sizes the chart from it', async () => {
    await renderChart({}, null);
    expect(screen.queryByTestId('line-chart', hidden)).toBeNull();
    await fireEvent(screen.getByTestId('trip-spend-chart-frame'), 'layout', { nativeEvent: { layout: { width: 280, height: 0 } } });
    const line = screen.getByTestId('line-chart', hidden).props;
    expect(line.width + line.dataPointsRadius).toBe(280);
  });

  it('shows the summary line', async () => {
    await renderChart();
    expect(screen.getByText(`Wydałem ${money(4000)} · Zostało ${money(6000)} z ${money(10000)}`)).toBeTruthy();
  });

  it('over budget: says by how much, in the over colour, and the left bar is empty', async () => {
    await renderChart({ style: 'bar', spentMinor: 12000, leftMinor: -2000 });
    const text = screen.getByText(`Wydałem ${money(12000)} · ${i18n.t('budget.over', { amount: money(2000) })}`);
    expect(text.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: colors.light.budget.over.foreground })]));
    expect(values('bar-chart')).toEqual([120, 0]);
  });

  it('is one button with a label and the amounts as value; onPress fires', async () => {
    const onPress = await renderChart();
    const button = screen.getByRole('button', { name: 'Pokaż budżet' });
    expect(button.props.accessibilityValue.text).toBe(`Wydałem ${money(4000)}, zostało ${money(6000)}, z ${money(10000)}`);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('over budget: the value reads the real budget as total, without "zostało"', async () => {
    await renderChart({ spentMinor: 12000, leftMinor: -2000 });
    const text = screen.getByRole('button', { name: 'Pokaż budżet' }).props.accessibilityValue.text;
    expect(text).toContain(money(10000));
    expect(text).toContain(i18n.t('budget.over', { amount: money(2000) }));
    expect(text).not.toContain('zostało');
  });

  it('shows a 2 dp focus ring while the card is focused', async () => {
    await renderChart();
    const card = () => StyleSheet.flatten(screen.getByTestId('trip-spend-chart').props.style);
    expect(card().outlineWidth).toBeUndefined();
    await fireEvent(screen.getByTestId('trip-spend-chart'), 'focus');
    expect(card()).toMatchObject({
      outlineWidth: tokens.components.focusRing.width,
      outlineOffset: tokens.components.focusRing.offset,
      outlineColor: colors.light.border.focus,
    });
    await fireEvent(screen.getByTestId('trip-spend-chart'), 'blur');
    expect(card().outlineWidth).toBeUndefined();
  });

  it.each([
    ['line', 'line-chart'],
    ['bar', 'bar-chart'],
    ['donut', 'pie-chart'],
  ] as const)('%s: the drawing lets touches through to the card, which opens the budget', async (style, testID) => {
    const onPress = await renderChart({ style });
    expect(screen.getByTestId(testID, hidden).parent?.props.pointerEvents).toBe('none');
    await fireEvent.press(screen.getByTestId('trip-spend-chart'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('animates unless reduce motion is on', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(false);
    await renderChart();
    expect(screen.getByTestId('line-chart', hidden).props.isAnimated).toBe(true);
  });

  it('reduce motion on: no animation', async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    await renderChart();
    expect(screen.getByTestId('line-chart', hidden).props.isAnimated).toBe(false);
  });

  it('hides the drawing from screen readers', async () => {
    await renderChart();
    const drawing = screen.getByTestId('trip-spend-chart-drawing', hidden);
    expect(drawing.props['aria-hidden']).toBe(true);
    expect(drawing.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('donut centre: the left amount', async () => {
    await renderChart({ style: 'donut' });
    expect(within(screen.getByTestId('trip-spend-chart-drawing', hidden)).getByText(money(6000), hidden)).toBeTruthy();
  });

  it('donut centre over budget: the amount and "over budget" on separate lines, the amount never broken, in the over colour', async () => {
    await renderChart({ style: 'donut', spentMinor: 12000, leftMinor: -2000 });
    const drawing = within(screen.getByTestId('trip-spend-chart-drawing', hidden));
    const amount = drawing.getByText(money(2000), hidden);
    expect(amount.props.numberOfLines).toBe(1);
    expect(amount.props.adjustsFontSizeToFit).toBe(true);
    expect(amount.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: colors.light.budget.over.foreground })]));
    expect(drawing.getByText(i18n.t('home.chartOverCentre'), hidden)).toBeTruthy();
  });

  it('donut centre is drawn once, by the card, not by the chart library', async () => {
    await renderChart({ style: 'donut' });
    expect(screen.getByTestId('pie-chart', hidden).props.centerLabelComponent).toBeUndefined();
    expect(screen.getAllByText(money(6000), hidden)).toHaveLength(1); // the summary line words it differently
  });

  it.each(['line', 'bar'] as const)('%s: the drawn width (plot + y-axis label + end spacing + point) stays inside the card', async (style) => {
    await renderChart({ style }, 300);
    const p = screen.getByTestId(`${style}-chart`, hidden).props;
    const drawn = p.width + p.yAxisLabelWidth + p.endSpacing + (p.dataPointsRadius ?? 0);
    expect(drawn).toBeLessThanOrEqual(300);
    expect(drawn).toBeGreaterThan(250);
  });

  it('bar: two bars on an axis from 0 up to the budget, left bar visible against the card', async () => {
    await renderChart({ style: 'bar', spentMinor: 15000000, leftMinor: 1035000000 }, 300);
    const p = screen.getByTestId('bar-chart', hidden).props;
    expect(values('bar-chart')).toEqual([150000, 10350000]);
    expect(p.maxValue).toBe(10500000);
    expect(p.data[1].frontColor).toBe(colors.light.border.default);
  });

  it('bar over budget: the axis reaches the spent bar', async () => {
    await renderChart({ style: 'bar', spentMinor: 12000, leftMinor: -2000 });
    expect(screen.getByTestId('bar-chart', hidden).props.maxValue).toBe(120);
  });

  it('line before the trip starts: no chart, a hint and the summary', async () => {
    await renderChart({ days: [], spentMinor: 0, leftMinor: 10000 });
    expect(screen.queryByTestId('line-chart', hidden)).toBeNull();
    expect(screen.getByText('Wykres pojawi się od pierwszego dnia wyjazdu.')).toBeTruthy();
    expect(screen.getByText(`Wydałem ${money(0)} · Zostało ${money(10000)} z ${money(10000)}`)).toBeTruthy();
  });

  it('line before the trip starts: the hint in English', async () => {
    await i18n.changeLanguage('en');
    await renderChart({ days: [], spentMinor: 0, leftMinor: 10000 });
    expect(screen.getByText('The chart will appear from the first day of the trip.')).toBeTruthy();
  });

  it.each([
    ['bar', 'bar-chart'],
    ['donut', 'pie-chart'],
  ] as const)('%s before the trip starts: drawn as usual', async (style, testID) => {
    await renderChart({ style, days: [], spentMinor: 0, leftMinor: 10000 });
    expect(screen.getByTestId(testID, hidden)).toBeTruthy();
  });
});
