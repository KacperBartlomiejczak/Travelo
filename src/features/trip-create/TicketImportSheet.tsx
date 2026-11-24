import { useRouter } from 'expo-router';
import { Camera, FileUp, TicketX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Checkbox } from '@/components/Checkbox';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextButton } from '@/components/TextButton';
import { ServerUnreachableError } from '@/data/errors';
import { NotATicketError, TicketLimitError, UnsupportedTicketFileError } from '@/data/ticket-import';
import { useExtractTicket } from '@/hooks/useExtractTicket';
import { useIsOffline } from '@/providers/BudgetSync';
import type { ExtractTicketResponse } from '@/schemas';
import { tokens } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { pickTicketPdf, pickTicketPhoto } from './ticket-pick';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The camera scan (works offline, Z6); the caller opens the scanner. */
  onScan: () => void;
  /** A ticket was read; nothing is saved, the caller fills the draft (D3). */
  onImported: (response: ExtractTicketResponse) => void;
  /** The sheet finished closing (after its exit animation). */
  onDismissed?: () => void;
};

type FileKind = 'pdf' | 'photo';
type Failure = 'notTicket' | 'limit' | 'unsupported' | 'tooLarge' | 'unreachable' | 'failed';

const failureOf = (error: unknown): Failure => {
  if (error instanceof NotATicketError) return 'notTicket';
  if (error instanceof TicketLimitError) return 'limit';
  if (error instanceof UnsupportedTicketFileError) return error.code === 'file_too_large' ? 'tooLarge' : 'unsupported';
  if (error instanceof ServerUnreachableError) return 'unreachable';
  return 'failed';
};

const ERROR_KEY = {
  limit: 'errorLimit',
  unsupported: 'errorUnsupported',
  tooLarge: 'errorTooLarge',
  unreachable: 'errorUnreachable',
  failed: 'errorFailed',
} as const;

// Ticket import sheet (ticket-import D1-D3): choice -> consent every time -> pick, send, read. The body is mounted only while the
// sheet is open, so the consent is never remembered.
export function TicketImportSheet({ visible, onClose, onScan, onImported, onDismissed }: Props) {
  const { t } = useTranslation();
  // Lifted from the body: an upload in flight cannot be dismissed.
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet visible={visible} title={t('newTrip.flights.import.title')} onClose={onClose} onDismissed={onDismissed} dismissible={!busy}>
      {visible ? <Body onClose={onClose} onScan={onScan} onImported={onImported} busy={busy} setBusy={setBusy} /> : null}
    </BottomSheet>
  );
}

function Body({ onClose, onScan, onImported, busy, setBusy }: Omit<Props, 'visible'> & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const offline = useIsOffline();
  const extract = useExtractTicket();
  const [step, setStep] = useState<'choose' | 'consent'>('choose');
  const [kind, setKind] = useState<FileKind>('pdf');
  const [accepted, setAccepted] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const sending = useRef(false);
  // The consent can be withdrawn while the picker is still working; send() re-checks it right before the upload.
  const acceptedRef = useRef(false);
  useEffect(() => {
    acceptedRef.current = accepted;
  }, [accepted]);
  // Body is mounted per open, so unmount = the sheet closed; a pending send() must then do nothing.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; // StrictMode runs mount -> cleanup -> mount
    return () => {
      mounted.current = false;
    };
  }, []);

  async function send() {
    if (sending.current) return; // a second tap while the picker is open must not start a second pick
    sending.current = true;
    let started = false;
    try {
      const file = await (kind === 'pdf' ? pickTicketPdf() : pickTicketPhoto());
      if (!file || !mounted.current || !acceptedRef.current) return;
      started = true;
      setBusy(true); // loading only once a file is chosen, not while the system picker is open
      const result = await extract.mutateAsync(file);
      if (mounted.current) onImported(result);
    } catch (error) {
      if (mounted.current) setFailure(failureOf(error));
    } finally {
      sending.current = false;
      if (started) setBusy(false); // an upload cannot be dismissed, so this one is always the current session's
    }
  }

  // Back to the consent: the checkbox is cleared, so a new send needs a new consent (D2).
  function startOver() {
    setFailure(null);
    setAccepted(false);
  }

  // The sheet is a native modal: it closes first, or the document would open behind it.
  function openPrivacy() {
    onClose();
    router.push('/legal/privacy');
  }

  const bodyText = [tokens.typography.styles.bodyMD, { color: theme.text.secondary }];

  if (busy) {
    return (
      <View
        testID="ticket-loading"
        accessibilityLiveRegion="polite"
        style={{
          alignItems: 'center',
          gap: tokens.spacing[3],
          paddingVertical: tokens.spacing[6],
        }}
      >
        <ActivityIndicator color={theme.brand.primary} />
        <Text style={[tokens.typography.styles.bodyMD, { color: theme.text.primary }]}>{t('newTrip.flights.import.loading')}</Text>
      </View>
    );
  }

  if (failure === 'notTicket') {
    return (
      <View
        testID="ticket-not-a-ticket"
        style={{
          alignItems: 'center',
          gap: tokens.spacing[3],
          paddingVertical: tokens.spacing[4],
        }}
      >
        <TicketX size={tokens.iconography.size.lg} strokeWidth={tokens.iconography.strokeWidth} color={theme.text.secondary} aria-hidden />
        <Text accessibilityRole="header" style={[tokens.typography.styles.headingSM, { color: theme.text.primary, textAlign: 'center' }]}>
          {t('newTrip.flights.import.notTicketTitle')}
        </Text>
        <Text style={[...bodyText, { textAlign: 'center' }]}>{t('newTrip.flights.import.notTicketBody')}</Text>
        <TextButton variant="secondary" label={t('newTrip.flights.import.chooseAnother')} onPress={startOver} />
      </View>
    );
  }

  if (failure) {
    return (
      <View testID="ticket-error" accessibilityRole="alert" style={{ gap: tokens.spacing[4] }}>
        <Text style={bodyText}>{t(`newTrip.flights.import.${ERROR_KEY[failure]}`)}</Text>
        <TextButton variant="secondary" label={t('newTrip.flights.import.retry')} onPress={startOver} />
      </View>
    );
  }

  if (step === 'choose') {
    return (
      <View style={{ gap: tokens.spacing[3] }}>
        {offline && <OfflineBanner text={t('newTrip.flights.import.offlineHint')} />}
        <TextButton
          variant="secondary"
          icon={FileUp}
          label={t('newTrip.flights.import.fromFile')}
          disabled={offline}
          onPress={() => setStep('consent')}
        />
        <TextButton variant="secondary" icon={Camera} label={t('newTrip.flights.import.scan')} onPress={onScan} />
      </View>
    );
  }

  return (
    <View style={{ gap: tokens.spacing[4] }}>
      <Text style={bodyText}>{t('newTrip.flights.import.consent')}</Text>
      <SegmentedControl
        label={t('newTrip.flights.import.fileType')}
        options={[
          { value: 'pdf', label: t('newTrip.flights.import.pdf') },
          { value: 'photo', label: t('newTrip.flights.import.photo') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Checkbox checked={accepted} onChange={setAccepted} label={t('newTrip.flights.import.accept')} />
      <View style={{ alignItems: 'flex-start' }}>
        <TextButton variant="ghost" label={t('newTrip.flights.import.privacyLink')} onPress={openPrivacy} />
      </View>
      <PrimaryButton label={t('newTrip.flights.import.send')} disabled={!accepted || offline} onPress={() => void send()} />
    </View>
  );
}
