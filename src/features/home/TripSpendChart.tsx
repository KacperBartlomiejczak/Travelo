import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";

import { useReduceMotion } from "@/hooks/useReduceMotion";
import { currencyMinorDigits, formatMoney } from "@/lib/money";
import type { DailySpend } from "@/schemas";
import type { ChartStylePreference } from "@/schemas/preferences";
import { tokens } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Props = {
  style: ChartStylePreference;
  days: DailySpend[];
  spentMinor: number;
  leftMinor: number;
  currency: string;
  onPress: () => void;
};

const { spacing, typography } = tokens;
const { focusRing } = tokens.components;
const CHART_HEIGHT = spacing[24] + spacing[12];
const INNER_RADIUS = CHART_HEIGHT / 3;
// gifted-charts draws width + yAxisLabelWidth + endSpacing (+ the point radius on a line) past its left edge, so the card's
// width is given to it with all of those at zero or subtracted; the y-axis text is hidden (the summary line has the amounts).
const POINT_RADIUS = spacing[1];

// The traveler's own spending on the trip card (trip-spend-chart A8): a line of spend per day, two bars (spent / left) or
// a donut. The whole card is one button to the budget tab; the drawing is decoration for the summary line under it.
export function TripSpendChart({
  style,
  days,
  spentMinor,
  leftMinor,
  currency,
  onPress,
}: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  // The card's real inner width (screen gutter, card padding and the max content width all vary); nothing is drawn before it is known.
  const [width, setWidth] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const money = (amountMinor: number) =>
    formatMoney(
      { amountMinor: Math.abs(amountMinor), currency },
      i18n.language,
    );
  // Charts want plain numbers; this is display only, no money math.
  const major = (amountMinor: number) =>
    amountMinor / 10 ** currencyMinorDigits(currency);

  const over = leftMinor < 0;
  // A line of spend per day has nothing to draw until the first trip day (trip-spend-chart A11).
  const beforeTrip = style === "line" && days.length === 0;
  const spentColor = over ? theme.budget.over.meter : theme.brand.primary;
  const left = Math.max(leftMinor, 0);
  const animated = reduceMotion === false;
  const centreColor = over ? theme.budget.over.foreground : theme.text.primary;
  const axisText = { ...typography.styles.bodySM, color: theme.text.secondary };
  const spentLabel = t("home.chartSpent");
  const leftLabel = t("home.chartLeft");

  const summary = over
    ? `${t("home.chartSpentAmount", { amount: money(spentMinor) })} · ${t("budget.over", { amount: money(leftMinor) })}`
    : t("home.chartSummary", {
        spent: money(spentMinor),
        left: money(left),
        total: money(spentMinor + left),
      });
  const total = money(spentMinor + leftMinor);
  const valueText = over
    ? t("home.chartValueOver", {
        spent: money(spentMinor),
        over: t("budget.over", { amount: money(leftMinor) }),
        total,
      })
    : t("home.chartValue", {
        spent: money(spentMinor),
        left: money(left),
        total,
      });

  const bars = [
    { value: major(spentMinor), label: spentLabel, frontColor: spentColor },
    {
      value: major(left),
      label: leftLabel,
      frontColor: theme.border.default, // `background.sunken` vanishes on the card
    },
  ];
  // The axis starts at 0 and ends at the budget, or at the spent bar when over it.
  const barMax = Math.max(major(spentMinor), major(spentMinor + leftMinor));

  return (
    <View
      testID="trip-spend-chart-frame"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Pressable
        testID="trip-spend-chart"
        accessibilityRole="button"
        accessibilityLabel={t("home.showBudget")}
        accessibilityValue={{ text: valueText }}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            minHeight: tokens.layout.touchTarget,
            gap: spacing[3],
            backgroundColor: pressed ? theme.background.sunken : undefined,
          },
          focused && {
            outlineStyle: "solid",
            outlineWidth: focusRing.width,
            outlineColor: theme.border.focus,
            outlineOffset: focusRing.offset,
          },
        ]}
      >
        {beforeTrip ? (
          <Text
            style={[typography.styles.bodySM, { color: theme.text.secondary }]}
          >
            {t("home.chartBeforeTrip")}
          </Text>
        ) : (
          <View
            testID="trip-spend-chart-drawing"
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            style={{ minHeight: CHART_HEIGHT, justifyContent: "center" }}
          >
            {width === null ? null : style === "line" ? (
              <View pointerEvents="none"><LineChart
                data={days.map((d) => ({
                  value: major(d.spentMinor),
                  label: String(Number(d.spentOn.slice(8))),
                }))}
                width={width - POINT_RADIUS}
                dataPointsRadius={POINT_RADIUS}
                yAxisLabelWidth={0}
                yAxisThickness={0}
                hideYAxisText
                endSpacing={0}
                height={CHART_HEIGHT}
                color={theme.brand.primary}
                dataPointsColor={theme.brand.primary}
                thickness={tokens.iconography.strokeWidth}
                spacing={Math.max(spacing[6], width / Math.max(days.length, 1))}
                initialSpacing={spacing[2]}
                noOfSections={3} // a count of grid lines, not a visual token
                rulesColor={theme.background.sunken}
                yAxisColor="transparent"
                xAxisColor={theme.background.sunken}
                yAxisTextStyle={axisText}
                xAxisLabelTextStyle={axisText}
                isAnimated={animated}
                scrollToEnd={false}
              /></View>
            ) : style === "bar" ? (
              <View pointerEvents="none"><BarChart
                data={bars}
                width={width}
                yAxisLabelWidth={0}
                yAxisThickness={0}
                hideYAxisText
                endSpacing={0}
                maxValue={barMax}
                height={CHART_HEIGHT}
                barWidth={spacing[12]}
                spacing={spacing[8]}
                noOfSections={3} // a count of grid lines, not a visual token
                rulesColor={theme.background.sunken}
                yAxisColor="transparent"
                xAxisColor={theme.background.sunken}
                yAxisTextStyle={axisText}
                xAxisLabelTextStyle={axisText}
                isAnimated={animated}
              /></View>
            ) : (
              <View
                pointerEvents="none"
                style={{ alignItems: "center", justifyContent: "center" }}
              >
                <PieChart
                  donut
                  data={[
                    { value: major(spentMinor), color: spentColor },
                    { value: major(left), color: theme.background.sunken },
                  ]}
                  radius={CHART_HEIGHT / 2}
                  innerRadius={INNER_RADIUS}
                  innerCircleColor={theme.surface.primary}
                  isAnimated={animated}
                />
                {/* Drawn here, not through the library's centerLabelComponent, which showed it twice on a device. */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: INNER_RADIUS * 2,
                    paddingHorizontal: spacing[1],
                    alignItems: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[typography.styles.labelLG, { color: centreColor }]}
                  >
                    {over ? money(leftMinor) : money(left)}
                  </Text>
                  {over && (
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[typography.styles.bodySM, { color: centreColor }]}
                    >
                      {t("home.chartOverCentre")}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        <Text
          style={[
            typography.styles.bodyMD,
            { color: over ? theme.budget.over.foreground : theme.text.primary },
          ]}
        >
          {summary}
        </Text>
      </Pressable>
    </View>
  );
}
