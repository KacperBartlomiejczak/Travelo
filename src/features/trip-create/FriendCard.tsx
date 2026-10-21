import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View, type LayoutChangeEvent } from 'react-native';

import { Card } from '@/components/Card';
import { InterestChips } from '@/components/InterestChips';
import { TextField } from '@/components/TextField';
import { useFriendLookup } from '@/hooks/useFriendLookup';
import { useMyProfile } from '@/hooks/useProfile';
import { useIsOffline } from '@/providers/BudgetSync';
import { FRIEND_CODE_LENGTH } from '@/schemas';
import { useTheme } from '@/theme/useTheme';

import { withCodeText, withFoundFriend, type FriendDraft } from './draft';
import { friendCodeStatus, type CodeStatus } from './friend-code';

type Props = {
  title: string;
  friend: FriendDraft;
  onChange: (friend: FriendDraft) => void;
  /** Translated name error. */
  nameError?: string;
  /** Translated error of the form schema for the code, e.g. the same friend twice. */
  codeError?: string;
  /** Codes already found in the other cards (friend-invite: the same friend cannot be added twice). */
  takenCodes?: readonly string[];
  /** True once "Dalej" was pressed: a code that is still short is then reported. */
  submitted?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

// Look-alike letters and nobody having the code read the same: there is no such user.
const MESSAGE_KEYS: Partial<Record<CodeStatus, string>> = {
  unknown: 'newTrip.friends.codeUnknown',
  own: 'newTrip.friends.codeOwn',
  duplicate: 'newTrip.friends.codeDuplicate',
  offline: 'newTrip.friends.codeOffline',
  unreachable: 'newTrip.friends.codeOffline',
  failed: 'newTrip.friends.codeCheckFailed',
};

// One friend: an optional friend code, name and interests grouped as in D11 (D32). A found code fills in the nick and the
// interests of that account and locks them (friend-invite D3); editing the code gives the card back (D9).
export function FriendCard({ title, friend, onChange, nameError, codeError, takenCodes = [], submitted = false, onLayout, testID }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const offline = useIsOffline();
  const { data: mine } = useMyProfile();
  const ownCode = mine?.profile.friendCode;

  const codeText = friend.codeText ?? '';
  const trimmed = codeText.trim();
  const linked = Boolean(friend.friendCode);

  // What the phone can decide itself comes first; only a plain, new code is sent to the server, once.
  const known = { text: codeText, linked, offline, ownCode, takenCodes };
  const { status: beforeServer, code } = friendCodeStatus(known);
  const needsServer = beforeServer === 'checking';
  const { data: found, error: lookupError, isError: lookupFailed } = useFriendLookup(needsServer ? code : null);
  const { status } = friendCodeStatus({ ...known, lookup: { data: found, error: lookupError, isError: lookupFailed } });

  // The answer arrives: the card takes the nick and interests of the account.
  useEffect(() => {
    if (needsServer && code !== null && found) onChange(withFoundFriend(friend, code, found));
  }, [needsServer, code, found, friend, onChange]);

  const messageKey = MESSAGE_KEYS[status];
  const message = messageKey ? t(messageKey) : status === 'incomplete' && submitted ? t('newTrip.friends.codeIncomplete') : undefined;
  // Offline with nothing typed is not an error, only the reason the field is off.
  const quiet = status === 'offline' && trimmed === '';

  return (
    <Card testID={testID} onLayout={onLayout}>
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{title}</Text>
      <View style={{ gap: theme.spacing[1] }}>
        <TextField
          label={t('newTrip.friends.code')}
          optional
          value={codeText}
          hint={quiet ? message : undefined}
          error={quiet ? undefined : (message ?? codeError)}
          editable={!offline}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={FRIEND_CODE_LENGTH}
          onChangeText={(text) => onChange(withCodeText(friend, text.toUpperCase()))}
        />
        {status === 'checking' && (
          <View
            testID="friend-code-checking"
            accessible
            accessibilityLabel={t('newTrip.friends.codeChecking')}
            accessibilityLiveRegion="polite"
            accessibilityState={{ busy: true }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
          >
            <ActivityIndicator color={theme.colors.text.secondary} />
            <Text style={[theme.typography.bodyS, { color: theme.colors.text.secondary }]}>{t('newTrip.friends.codeChecking')}</Text>
          </View>
        )}
      </View>
      <TextField
        label={t('newTrip.friends.name')}
        value={friend.displayName}
        error={nameError}
        editable={!linked}
        autoCapitalize="words"
        onChangeText={(displayName) => onChange({ ...friend, displayName })}
      />
      <Text style={[theme.typography.bodyMMedium, { color: theme.colors.text.primary }]}>{t('newTrip.friends.interests')}</Text>
      <InterestChips selected={friend.interests} disabled={linked} onChange={(interests) => onChange({ ...friend, interests })} />
    </Card>
  );
}
