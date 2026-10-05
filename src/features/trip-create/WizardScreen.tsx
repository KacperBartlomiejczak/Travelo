import { useRouter } from 'expo-router';
import { CircleX, type LucideIcon } from 'lucide-react-native';
import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { StepIndicator } from '@/components/StepIndicator';
import { useTheme } from '@/theme/useTheme';

import { nextStep, stepRoute, wizardSteps, type WizardStep } from './steps';
import { useTripDraft } from './TripDraftContext';

type Props = {
  step: WizardStep;
  children?: ReactNode;
  /** Bottom action, pinned in the thumb zone. */
  action?: { label: string; onPress: () => void; loading?: boolean; icon?: LucideIcon; error?: string };
  /** Lets the step scroll, e.g. to the first error (D29). */
  scrollRef?: RefObject<ScrollView | null>;
};

// Shared frame of every wizard step: step indicator, scrollable content, primary action at the bottom.
export function WizardScreen({ step, children, action, scrollRef }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { draft } = useTripDraft();
  const steps = wizardSteps(draft.companionCount);
  const horizontal = width < theme.breakpoints.compact ? theme.spacing[4] : theme.spacing[5];

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { maxWidth: theme.size.maxContentWidth, paddingHorizontal: horizontal, paddingTop: theme.spacing[4], gap: theme.spacing[6] },
        ]}
      >
        <StepIndicator current={steps.indexOf(step) + 1} total={steps.length} />
        {children}
      </ScrollView>
      {action && (
        <View
          style={[
            styles.content,
            {
              maxWidth: theme.size.maxContentWidth,
              paddingHorizontal: horizontal,
              paddingTop: theme.spacing[3],
              paddingBottom: insets.bottom + theme.spacing[4],
            },
          ]}
        >
          {action.error && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], marginBottom: theme.spacing[3] }}>
              <CircleX size={theme.size.iconInline} strokeWidth={theme.size.iconStroke} color={theme.colors.status.error} aria-hidden />
              <Text
                accessibilityLiveRegion="polite"
                style={[theme.typography.bodyS, { color: theme.colors.status.error, flexShrink: 1 }]}
              >
                {action.error}
              </Text>
            </View>
          )}
          <PrimaryButton label={action.label} icon={action.icon} onPress={action.onPress} loading={action.loading} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', alignSelf: 'center' },
});

/** Navigates from `step` to the next wizard step (skipping friends when travelling alone). */
export function useGoToNextStep(step: WizardStep): () => void {
  const router = useRouter();
  const { draft } = useTripDraft();
  return () => {
    const next = nextStep(step, draft.companionCount);
    if (next) router.push(stepRoute(next));
  };
}
