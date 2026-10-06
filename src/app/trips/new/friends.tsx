import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Text, View, type ScrollView } from 'react-native';

import { fieldErrors } from '@/features/trip-create/field-errors';
import { FriendCard } from '@/features/trip-create/FriendCard';
import { useTripDraft } from '@/features/trip-create/TripDraftContext';
import { useGoToNextStep, WizardScreen } from '@/features/trip-create/WizardScreen';
import { DISPLAY_NAME_MAX_LENGTH, FriendsStepInputSchema } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

// Step 2 — who flies along and what they enjoy (D7, D11, D32).
export default function FriendsStep() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { draft, setDraft } = useTripDraft();
  const goNext = useGoToNextStep('friends');
  const [submitted, setSubmitted] = useState(false);
  const input = { friends: draft.friends };
  const errors = submitted ? fieldErrors(FriendsStepInputSchema.safeParse(input)) : {};
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<number, number>>({});

  function next() {
    setSubmitted(true);
    const result = FriendsStepInputSchema.safeParse(input);
    if (result.success) {
      goNext();
      return;
    }
    // Same as the flights step (D29): announce and scroll to the first friend with an error.
    AccessibilityInfo.announceForAccessibility(t('newTrip.fixErrors'));
    const failed = Object.keys(fieldErrors(result));
    const index = draft.friends.findIndex((_, i) => failed.some((key) => key.startsWith(`friends.${i}.`)));
    if (index >= 0) scrollRef.current?.scrollTo({ y: Math.max(0, (cardY.current[index] ?? 0) - theme.spacing[4]), animated: true });
  }

  return (
    <WizardScreen step="friends" scrollRef={scrollRef} action={{ label: t('newTrip.next'), onPress: next }}>
      <View style={{ gap: theme.spacing[2] }}>
        <Text accessibilityRole="header" style={[theme.typography.heading2, { color: theme.colors.text.primary }]}>
          {t('newTrip.friends.heading')}
        </Text>
        <Text style={[theme.typography.bodyM, { color: theme.colors.text.secondary }]}>{t('newTrip.friends.hint')}</Text>
      </View>
      {draft.friends.map((friend, index) => {
        const nameError = errors[`friends.${index}.displayName`];
        return (
          // Friends are only added/removed at the end (D10), so the index is a stable key.
          <FriendCard
            key={index}
            testID={`friend-${index + 1}`}
            title={t('newTrip.friends.card', { number: index + 1 })}
            friend={friend}
            nameError={nameError ? t(nameError, { max: DISPLAY_NAME_MAX_LENGTH }) : undefined}
            onLayout={(event) => (cardY.current[index] = event.nativeEvent.layout.y)}
            onChange={(changed) =>
              setDraft((current) => ({ ...current, friends: current.friends.map((f, i) => (i === index ? changed : f)) }))
            }
          />
        );
      })}
    </WizardScreen>
  );
}
