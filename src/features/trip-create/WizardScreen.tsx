import { useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { CircleX, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from 'react-native';
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

// iOS only (wizard-keyboard Q5, D6): the frame's padding already makes room for the keyboard, so the scroll view must not
// adjust by itself too (`automaticallyAdjustKeyboardInsets`). Once the keyboard is shown, a focused field still below the
// visible part is scrolled up to sit `gap` above "Dalej". Returns the scroll view props it needs; Android gets none (D4).
function useScrollFocusedFieldIntoView(scroll: RefObject<ScrollView | null>, gap: number): ScrollViewProps {
  const ios = Platform.OS === 'ios';
  // `scrollTo` wants an absolute offset, so the current one is tracked.
  const scrolledY = useRef(0);

  useEffect(() => {
    if (!ios) return;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const field = TextInput.State.currentlyFocusedInput();
      const view = scroll.current?.getNativeScrollRef();
      if (!field || !view) return;
      // Window coordinates already include how far the form is scrolled.
      view.measureInWindow((_x, viewTop, _width, viewHeight) => {
        field.measureInWindow((_fieldX, fieldTop, _fieldWidth, fieldHeight) => {
          const hidden = fieldTop + fieldHeight + gap - (viewTop + viewHeight);
          if (hidden > 0) scroll.current?.scrollTo({ y: scrolledY.current + hidden, animated: true });
        });
      });
    });
    return () => subscription.remove();
  }, [ios, scroll, gap]);

  if (!ios) return {};
  return {
    onScroll: (event) => (scrolledY.current = event.nativeEvent.contentOffset.y),
    scrollEventThrottle: 16,
  };
}

// Shared frame of every wizard step: step indicator, scrollable content, primary action at the bottom.
// The keyboard pushes the whole frame up, so the focused field and the action stay above it (wizard-keyboard D2).
export function WizardScreen({ step, children, action, scrollRef }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The frame sits under the stack header; the keyboard's position is measured from the top of the window.
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const { draft } = useTripDraft();
  const steps = wizardSteps(draft.companionCount);
  const horizontal = width < theme.breakpoints.compact ? theme.spacing[4] : theme.spacing[5];
  const ownScrollRef = useRef<ScrollView>(null);
  const scroll = scrollRef ?? ownScrollRef;
  const keyboardScrollProps = useScrollFocusedFieldIntoView(scroll, theme.spacing[4]);

  return (
    // `padding` on Android too: with edge-to-edge the window is not resized for the keyboard (D3).
    <KeyboardAvoidingView
      testID="wizard-screen"
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        ref={scroll}
        testID="wizard-scroll"
        keyboardShouldPersistTaps="handled"
        {...keyboardScrollProps}
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
    </KeyboardAvoidingView>
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
